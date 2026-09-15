"""Service d'envoi d'emails SMTP (DB super-admin prioritaire, .env en fallback).

Conforme aux principes Ponytail (stdlib smtplib + email.mime, zéro dépendances lourdes).
La config effective est résolue via app.services.mail_config (DB > env) pour
permettre une mise en production sans redéploiement.
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings
from app.services.mail_config import EffectiveSmtpConfig, get_effective_smtp_config

logger = logging.getLogger(__name__)


def _build_mime_message(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
    from_email: str | None = None,
    from_name: str | None = None,
) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name or settings.smtp_from_name} <{from_email or settings.smtp_from_email}>"
    msg["To"] = to_email

    plain = text_content or "Veuillez afficher ce message au format HTML."
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))
    return msg


def _send_via_config(
    cfg: EffectiveSmtpConfig,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> bool:
    """Envoi synchrone avec une config SMTP explicite (testable)."""
    msg = _build_mime_message(to_email, subject, html_content, text_content, cfg.from_email, cfg.from_name)
    try:
        if cfg.use_ssl:
            server = smtplib.SMTP_SSL(cfg.host, cfg.port, timeout=15)
        else:
            server = smtplib.SMTP(cfg.host, cfg.port, timeout=15)
            if cfg.use_tls:
                server.starttls()

        with server:
            if cfg.user and cfg.password:
                server.login(cfg.user, cfg.password)
            server.send_message(msg)
        logger.info(f"Email envoyé à {to_email} via {cfg.host}:{cfg.port} (source={cfg.source})")
        return True
    except Exception as exc:
        logger.warning(f"Échec envoi email à {to_email} via {cfg.host}:{cfg.port} (source={cfg.source}): {exc}")
        raise


def send_email_sync(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
) -> bool:
    """Envoie un email de manière synchrone via SMTP (.env — chemin legacy)."""
    cfg = EffectiveSmtpConfig(
        host=settings.smtp_host, port=settings.smtp_port,
        user=settings.smtp_user, password=settings.smtp_password,
        use_tls=settings.smtp_tls, use_ssl=False,
        from_email=settings.smtp_from_email, from_name=settings.smtp_from_name,
        frontend_url=settings.frontend_url, source="env",
    )
    try:
        return _send_via_config(cfg, to_email, subject, html_content, text_content)
    except Exception as exc:
        logger.warning(
            f"Impossible d'envoyer l'email à {to_email} via SMTP {cfg.host}:{cfg.port}. "
            f"Erreur: {exc}. (Note: En dev, assurez-vous que Mailpit tourne sur localhost:1025)"
        )
        return False


async def send_email_async(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str = "",
    db=None,
    smtp_config=None,
) -> bool:
    """Envoie un email sans bloquer la boucle FastAPI (config DB prioritaire)."""
    cfg = smtp_config
    if cfg is None:
        try:
            cfg = await get_effective_smtp_config(db)
        except Exception:
            cfg = await get_effective_smtp_config(None)
    try:
        return await asyncio.to_thread(_send_via_config, cfg, to_email, subject, html_content, text_content)
    except Exception as exc:
        logger.warning(f"Échec envoi async vers {to_email}: {exc}")
        return False


def build_test_email_content(from_name: str) -> tuple[str, str, str]:
    subject = f"Test SMTP — {from_name} : configuration valide ✅"
    html_content = f"""
    <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
    <body style="font-family: 'Segoe UI', sans-serif; background:#f4f6f9; padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e1e8ed;">
        <div style="background:#0f172a;color:#fff;padding:20px;text-align:center;">
          <h2 style="margin:0;">{from_name}</h2><p style="margin:4px 0 0;">Test de configuration SMTP</p>
        </div>
        <div style="padding:24px;">
          <p>✅ Votre configuration email est <strong>opérationnelle</strong>.</p>
          <p style="color:#64748b;font-size:13px;">Les emails transactionnels (vérification, reset password, bienvenue) utiliseront désormais ce SMTP en production.</p>
        </div>
        <div style="background:#f8fafc;padding:12px;text-align:center;font-size:12px;color:#64748b;">&copy; {from_name}</div>
      </div>
    </body></html>
    """
    text_content = f"Test SMTP {from_name} : configuration valide. Les emails transactionnels utiliseront ce SMTP."
    return subject, html_content, text_content



async def send_reset_password_email(
    to_email: str,
    reset_token: str,
    user_name: str = "",
    db=None,
    smtp_config=None,
) -> bool:
    """Envoie l'email de réinitialisation de mot de passe."""
    cfg = smtp_config
    if cfg is None:
        try:
            cfg = await get_effective_smtp_config(db)
        except Exception:
            cfg = await get_effective_smtp_config(None)
    reset_link = f"{cfg.frontend_url}/reset-password?token={reset_token}"
    greeting = f"Bonjour {user_name}," if user_name.strip() else "Bonjour,"
    brand = cfg.from_name

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
        db=db,
        smtp_config=cfg,
    )


async def send_welcome_entreprise_email(
    to_email: str,
    entreprise_nom: str,
    admin_nom: str,
    db=None,
    smtp_config=None,
) -> bool:
    """Envoie un email de bienvenue suite à la création d'une entreprise."""
    cfg = smtp_config
    if cfg is None:
        try:
            cfg = await get_effective_smtp_config(db)
        except Exception:
            cfg = await get_effective_smtp_config(None)
    login_link = f"{cfg.frontend_url}/login"

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
        db=db,
        smtp_config=cfg,
    )


async def send_email_verification_email(
    to_email: str,
    verification_token: str | None = None,
    admin_nom: str = "",
    entreprise_nom: str = "",
    token: str | None = None,
    db=None,
) -> bool:
    """Envoie l'email de confirmation d'adresse email après inscription entreprise."""
    try:
        cfg = await get_effective_smtp_config(db)
    except Exception:
        cfg = await get_effective_smtp_config(None)
    actual_token = verification_token or token or ""
    verify_link = f"{cfg.frontend_url}/verify-email?token={actual_token}"
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
        db=db,
    )
