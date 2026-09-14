"""Service d'envoi d'emails SMTP (Mailpit en dev, SMTP configurable en prod).

Conforme aux principes Ponytail (stdlib smtplib + email.mime, zéro dépendances lourdes).
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)


def _build_mime_message(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email

    plain = text_content or "Veuillez afficher ce message au format HTML."
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))
    return msg


def send_email_sync(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> bool:
    """Envoie un email de manière synchrone via SMTP."""
    msg = _build_mime_message(to_email, subject, html_content, text_content)
    try:
        if settings.smtp_tls:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)

        with server:
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info(f"Email envoyé avec succès à {to_email} (Sujet: {subject})")
        return True
    except Exception as exc:
        logger.warning(
            f"Impossible d'envoyer l'email à {to_email} via SMTP {settings.smtp_host}:{settings.smtp_port}. "
            f"Erreur: {exc}. (Note: En dev, assurez-vous que Mailpit tourne sur localhost:1025)"
        )
        return False


async def send_email_async(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> bool:
    """Envoie un email en arrière-plan sans bloquer la boucle d'événements FastAPI."""
    return await asyncio.to_thread(
        send_email_sync, to_email, subject, html_content, text_content
    )


async def send_reset_password_email(
    to_email: str,
    reset_token: str,
    user_name: str = "",
) -> bool:
    """Envoie l'email de réinitialisation de mot de passe."""
    reset_link = f"{settings.frontend_url}/reset-password?token={reset_token}"
    greeting = f"Bonjour {user_name}," if user_name.strip() else "Bonjour,"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e1e8ed; }}
            .header {{ background-color: #1e293b; color: #ffffff; padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; color: #f8fafc; letter-spacing: 0.5px; }}
            .content {{ padding: 32px 24px; line-height: 1.6; }}
            .btn {{ display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 15px; box-shadow: 0 2px 4px rgba(37,99,235,0.3); }}
            .footer {{ background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
            .link-alt {{ word-break: break-all; font-size: 12px; color: #2563eb; background: #eff6ff; padding: 10px; border-radius: 4px; display: block; margin-top: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>TIA INFO BUILD</h1>
            </div>
            <div class="content">
                <p><strong>{greeting}</strong></p>
                <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte TIA INFO BUILD.</p>
                <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
                <div style="text-align: center;">
                    <a href="{reset_link}" class="btn">Réinitialiser mon mot de passe</a>
                </div>
                <p>Ce lien est valide pendant <strong>30 minutes</strong>. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail en toute sécurité.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                <p style="font-size: 12px; color: #64748b;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
                <span class="link-alt">{reset_link}</span>
            </div>
            <div class="footer">
                &copy; {settings.smtp_from_name} — Logiciel de Gestion BTP & Multi-chantiers.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    {greeting}

    Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte TIA INFO BUILD.
    Veuillez cliquer sur le lien ci-dessous (valide 30 minutes) pour réinitialiser votre mot de passe :

    {reset_link}

    Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
    """

    return await send_email_async(
        to_email=to_email,
        subject="Réinitialisation de votre mot de passe - TIA INFO BUILD",
        html_content=html_content,
        text_content=text_content,
    )


async def send_welcome_entreprise_email(
    to_email: str,
    entreprise_nom: str,
    admin_nom: str,
) -> bool:
    """Envoie un email de bienvenue suite à la création d'une entreprise."""
    login_link = f"{settings.frontend_url}/login"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e1e8ed; }}
            .header {{ background-color: #0f172a; color: #ffffff; padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8; }}
            .content {{ padding: 32px 24px; line-height: 1.6; }}
            .btn {{ display: inline-block; background-color: #0284c7; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 15px; }}
            .footer {{ background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Bienvenue sur TIA INFO BUILD</h1>
            </div>
            <div class="content">
                <p><strong>Bonjour {admin_nom},</strong></p>
                <p>Félicitations ! L'entreprise <strong>{entreprise_nom}</strong> a été enregistrée avec succès sur la plateforme TIA INFO BUILD.</p>
                <p>Vous disposez désormais d'un compte Administrateur d'Entreprise vous permettant de :</p>
                <ul>
                    <li>Gérer vos chantiers et ressources (RH, matériels, stocks)</li>
                    <li>Inviter des collaborateurs et attribuer leurs rôles BTP</li>
                    <li>Personnaliser l'en-tête de vos badges QR, devis et factures</li>
                </ul>
                <div style="text-align: center;">
                    <a href="{login_link}" class="btn">Accéder à mon espace</a>
                </div>
            </div>
            <div class="footer">
                &copy; TIA INFO BUILD — Plateforme de Gestion globale pour Entreprises de BTP.
            </div>
        </div>
    </body>
    </html>
    """

    return await send_email_async(
        to_email=to_email,
        subject=f"Bienvenue sur TIA INFO BUILD — {entreprise_nom}",
        html_content=html_content,
        text_content=f"Bienvenue {admin_nom} ! Votre entreprise {entreprise_nom} a été créée avec succès. Connectez-vous sur : {login_link}",
    )


async def send_email_verification_email(
    to_email: str,
    verification_token: str | None = None,
    admin_nom: str = "",
    entreprise_nom: str = "",
    token: str | None = None,
) -> bool:
    """Envoie l'email de confirmation d'adresse email après inscription entreprise."""
    actual_token = verification_token or token or ""
    verify_link = f"{settings.frontend_url}/verify-email?token={actual_token}"
    greeting = f"Bonjour {admin_nom}," if admin_nom.strip() else "Bonjour,"

    html_content = f"""
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0fdf4; margin: 0; padding: 20px; color: #1a1a2e; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); border: 1px solid #bbf7d0; }}
            .header {{ background: linear-gradient(135deg, #065f46 0%, #059669 100%); padding: 28px 24px; text-align: center; }}
            .header h1 {{ margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #fff; }}
            .header p {{ margin: 0; font-size: 13px; color: #a7f3d0; }}
            .badge {{ display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }}
            .content {{ padding: 32px 28px; line-height: 1.7; }}
            .company-name {{ background: #f0fdf4; border-left: 4px solid #059669; padding: 10px 16px; border-radius: 4px; font-weight: 700; color: #065f46; margin: 16px 0; font-size: 16px; }}
            .btn-wrapper {{ text-align: center; margin: 28px 0 20px; }}
            .btn {{ display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(5,150,105,0.35); }}
            .info-box {{ background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400e; }}
            .link-alt {{ word-break: break-all; font-size: 11px; color: #059669; background: #f0fdf4; padding: 10px 14px; border-radius: 4px; display: block; margin-top: 12px; border: 1px dashed #86efac; }}
            .footer {{ background-color: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
            .steps {{ counter-reset: step; list-style: none; padding: 0; margin: 16px 0; }}
            .steps li {{ counter-increment: step; display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; font-size: 14px; }}
            .steps li::before {{ content: counter(step); background: #059669; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>TIA INFO BUILD</h1>
                <p>Plateforme de Gestion BTP</p>
                <span class="badge">✉ Vérification d'email</span>
            </div>
            <div class="content">
                <p><strong>{greeting}</strong></p>
                <p>Merci d'avoir créé votre entreprise sur TIA INFO BUILD. Une dernière étape est nécessaire avant d'accéder à votre espace :</p>
                <div class="company-name">🏗 {entreprise_nom}</div>
                <p>Veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :</p>
                <div class="btn-wrapper">
                    <a href="{verify_link}" class="btn">✅ Confirmer mon adresse email</a>
                </div>
                <div class="info-box">
                    ⏳ Ce lien est valide pendant <strong>24 heures</strong>. Après confirmation, vous serez redirigé vers la page de connexion.
                </div>
                <p style="font-size: 13px; color: #475569;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :</p>
                <span class="link-alt">{verify_link}</span>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
                <p style="font-size: 13px; color: #64748b;">Si vous n'avez pas créé de compte sur TIA INFO BUILD, vous pouvez ignorer cet e-mail en toute sécurité.</p>
            </div>
            <div class="footer">
                &copy; {settings.smtp_from_name} — Logiciel de Gestion BTP &amp; Multi-chantiers.
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    {greeting}

    Merci d'avoir créé votre entreprise "{entreprise_nom}" sur TIA INFO BUILD.

    Veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous (valide 24 heures) :

    {verify_link}

    Après confirmation, vous serez redirigé vers la page de connexion.

    Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
    """

    return await send_email_async(
        to_email=to_email,
        subject=f"Confirmez votre email — TIA INFO BUILD ({entreprise_nom})",
        html_content=html_content,
        text_content=text_content,
    )
