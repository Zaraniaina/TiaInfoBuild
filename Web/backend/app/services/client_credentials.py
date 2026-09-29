"""Service: fiche d'accès client (PDF) et envoi par email.

Génère le document remis au client lors de la création de sa fiche : informations
client, login, mot de passe temporaire et lien vers l'Espace Client, puis l'envoie
en pièce jointe via le service SMTP (config DB > .env).

Règle de robustesse : la génération et l'envoi ne doivent JAMAIS faire échouer la
création du client — toute erreur est capturée, journalisée et remontée sous forme
de tuple `(email_envoye, message_erreur)`.
"""
from __future__ import annotations

import logging
from datetime import datetime

from app.config import settings
from app.services.email import send_client_credentials_email
from app.services.mail_config import EffectiveSmtpConfig, get_effective_smtp_config

logger = logging.getLogger(__name__)

__all__ = [
    "CHEMIN_CONNEXION_CLIENT",
    "charger_config_smtp",
    "envoyer_fiche_acces_client",
    "pdf_filename",
    "render_fiche_acces_client_pdf",
    "resolve_login_url",
]

# Chemin de la page de connexion client côté frontend (route /client-login).
CHEMIN_CONNEXION_CLIENT = "/client-login"


def pdf_filename(client) -> str:
    """Nom du fichier PDF remis au client (traçable par identifiant de fiche)."""
    identifiant = getattr(client, "id", None) or "nouveau"
    return f"fiche-acces-client-{identifiant}.pdf"


def resolve_login_url(cfg: EffectiveSmtpConfig | None = None, path: str | None = None) -> str:
    """Construit l'URL de connexion à l'Espace Client.

    `path` peut être un chemin relatif (`/client-login`, valeur par défaut) ou une
    URL absolue (déjà fournie par l'appelant), auquel cas elle est retournée telle
    quelle.
    """
    chemin = (path or CHEMIN_CONNEXION_CLIENT).strip()
    if chemin.startswith("http://") or chemin.startswith("https://"):
        return chemin
    if not chemin.startswith("/"):
        chemin = f"/{chemin}"
    base = ((cfg.frontend_url if cfg is not None else settings.frontend_url) or "").rstrip("/")
    return f"{base}{chemin}"


async def charger_config_smtp(db=None) -> EffectiveSmtpConfig:
    """Résout la config SMTP effective (table mail_settings > .env), sans jamais lever."""
    try:
        return await get_effective_smtp_config(db)
    except Exception:
        return await get_effective_smtp_config(None)


def _texte(valeur) -> str:
    """Normalise une valeur pour les polices coeur de fpdf2 (encodage latin-1)."""
    brut = "" if valeur is None else str(valeur)
    remplacements = {
        "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"',
        "\u00ab": '"', "\u00bb": '"', "\u20ac": "EUR", "\u2026": "...",
        "\u00a0": " ", "\u2022": "-", "\u2013": "-", "\u2014": "-",
    }
    for source, cible in remplacements.items():
        brut = brut.replace(source, cible)
    return brut.encode("latin-1", "replace").decode("latin-1")


def render_fiche_acces_client_pdf(
    *,
    client,
    utilisateur,
    entreprise=None,
    temp_password: str,
    login_url: str | None = None,
) -> bytes:
    """Rend la fiche d'accès client au format PDF A4 (fpdf2, zéro dépendance lourde).

    Reprend la mise en page du « bon de création » utilisateur existant : libellés
    sans accent (polices coeur fpdf2) et valeurs normalisées via `_texte()`.
    """
    from fpdf import FPDF

    entreprise_nom = _texte(getattr(entreprise, "nom", None) or getattr(client, "entreprise", None) or "-")
    login = _texte(getattr(utilisateur, "email", None) or getattr(client, "email", None) or "-")
    mot_de_passe = _texte(temp_password)
    date_edition = datetime.now().strftime("%d/%m/%Y a %H:%M")

    nom_complet = " ".join(
        p for p in [
            (getattr(client, "prenom", None) or "").strip(),
            (getattr(client, "nom", None) or "").strip(),
        ] if p
    ).strip()
    ville_ligne = " ".join(
        p for p in [
            (getattr(client, "code_postal", None) or "").strip(),
            (getattr(client, "ville", None) or "").strip(),
        ] if p
    ).strip()
    adresse = ", ".join(
        p for p in [
            (getattr(client, "adresse", None) or "").strip(),
            (getattr(client, "adresse_complement", None) or "").strip(),
            ville_ligne,
            (getattr(client, "pays", None) or "").strip(),
        ] if p
    )
    telephone = (
        getattr(client, "telephone", None) or getattr(client, "portable", None) or ""
    )
    infos_client = [
        ("Nom & Prenom :", nom_complet),
        ("Raison sociale :", getattr(client, "entreprise", None) or ""),
        ("Email :", getattr(client, "email", None) or ""),
        ("Telephone :", telephone),
        ("Adresse :", adresse),
    ]

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)
    pdf.add_page()

    # --- Bandeau ---
    pdf.set_fill_color(16, 26, 48)
    pdf.set_text_color(248, 250, 252)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 12, _texte("TIA INFO BUILD"), border=0, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 8, _texte("Fiche d'acces a l'Espace Client"), border=0, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    pdf.set_text_color(100, 116, 139)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 5, _texte(f"Emis par : {entreprise_nom}"), new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, _texte(f"Date d'edition : {date_edition}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    def ligne(label: str, valeur) -> None:
        pdf.set_x(15)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(20, 20, 20)
        pdf.cell(45, 6, _texte(label), new_x="RIGHT", new_y="TOP")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 6, _texte(valeur))

    def titre(texte: str, couleur=(16, 26, 48)) -> None:
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(*couleur)
        pdf.cell(0, 7, _texte(texte), new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(226, 232, 240)
        pdf.line(15, pdf.get_y(), 195, pdf.get_y())
        pdf.ln(2)

    # --- Informations client ---
    titre("Informations client")
    for label, valeur in infos_client:
        if (valeur or "").strip():
            ligne(label, valeur)

    # --- Identifiants de connexion ---
    titre("Identifiants de connexion")
    ligne("Login / Email :", login)
    ligne("Profil :", "Client (client)")
    ligne("Entreprise :", entreprise_nom)

    # --- Mot de passe temporaire ---
    titre("Mot de passe temporaire", couleur=(170, 38, 46))
    pdf.set_x(15)
    pdf.set_font("Courier", "B", 14)
    pdf.set_text_color(0, 0, 0)
    pdf.set_draw_color(170, 38, 46)
    pdf.cell(0, 10, mot_de_passe, border=1, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(
        0, 5,
        _texte("Ce mot de passe expire a la premiere connexion : pensez a le modifier."),
        align="C", new_x="LMARGIN", new_y="NEXT",
    )

    # --- Lien de connexion ---
    if login_url:
        titre("Lien de connexion")
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(0, 0, 150)
        pdf.multi_cell(0, 6, _texte(login_url))
        pdf.set_text_color(0, 0, 0)

    # --- Pied de page ---
    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(140, 140, 140)
    pdf.cell(
        0, 5,
        _texte("Document genere automatiquement par TIA INFO BUILD - Diffusion interdite."),
        align="C", new_x="LMARGIN", new_y="NEXT",
    )

    return bytes(pdf.output())



def _nom_client(client) -> str:
    """Nom d'affichage du client (contact, avec repli sur la raison sociale)."""
    contact = " ".join(
        p for p in [
            (getattr(client, "prenom", None) or "").strip(),
            (getattr(client, "nom", None) or "").strip(),
        ] if p
    ).strip()
    return contact or (getattr(client, "entreprise", None) or "").strip()


async def envoyer_fiche_acces_client(
    *,
    db,
    client,
    utilisateur,
    entreprise=None,
    temp_password: str,
    login_url: str | None = None,
) -> tuple[bool, str | None]:
    """Génère puis envoie la fiche d'accès client par email (pièce jointe PDF).

    Retourne `(email_envoye, message_erreur)`. Cette fonction **ne lève jamais** :
    la création de la fiche client ne doit pas dépendre de la disponibilité SMTP.
    """
    destinataire = (
        (getattr(client, "email", None) or getattr(utilisateur, "email", None) or "")
    ).strip()
    if not destinataire:
        return False, "Ce client n'a pas d'adresse email"

    cfg = await charger_config_smtp(db)
    entreprise_nom = (
        getattr(entreprise, "nom", None)
        or getattr(client, "entreprise", None)
        or cfg.from_name
    )

    try:
        url = resolve_login_url(cfg, login_url)
        pdf_bytes = render_fiche_acces_client_pdf(
            client=client,
            utilisateur=utilisateur,
            entreprise=entreprise,
            temp_password=temp_password,
            login_url=url,
        )
    except Exception as exc:
        logger.warning(
            "Génération de la fiche d'accès impossible (client %s) : %s",
            getattr(client, "id", "?"), exc,
        )
        return False, f"Génération du PDF impossible : {exc}"

    try:
        envoye = await send_client_credentials_email(
            to_email=destinataire,
            nom_client=_nom_client(client),
            login=(getattr(utilisateur, "email", None) or destinataire),
            login_url=url,
            pdf_bytes=pdf_bytes,
            pdf_filename=pdf_filename(client),
            entreprise_nom=entreprise_nom,
            db=db,
            smtp_config=cfg,
        )
    except Exception as exc:
        logger.warning("Envoi de la fiche d'accès impossible vers %s : %s", destinataire, exc)
        return False, f"Envoi de l'email impossible : {exc}"

    if envoye:
        logger.info(
            "Fiche d'accès client envoyée à %s (%s)", destinataire, pdf_filename(client)
        )
        return True, None
    return False, "Envoi de l'email impossible (SMTP indisponible ou mal configuré)"

