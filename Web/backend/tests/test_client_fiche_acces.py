"""Tests de la fiche d'accès client : PDF + envoi automatique par email.

Couvre :
- le rendu du PDF (identifiants, mot de passe temporaire, lien de connexion) ;
- l'envoi automatique de la fiche par email (pièce jointe application/pdf) ;
- le repli manuel quand le client n'a pas d'email ou quand le SMTP échoue ;
- le renvoi des identifiants (régénération du mot de passe temporaire) ;
- le téléchargement de la fiche (en-tête Content-Disposition) ;
- les garde-fous RBAC.

Aucun réseau : `app.services.email._send_via_config` est remplacé par un doublet
(même approche que tests/test_mail_settings.py).
"""
import re
import zlib
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models.entreprise import Entreprise
from app.models.role import Role
from app.models.utilisateur import Utilisateur
from app.security import verify_password
from app.services.client_credentials import render_fiche_acces_client_pdf

BASE = "/api/commercial/clients"


class _FakeSend:
    """Doublet de `_send_via_config` : capture les envois (dont les pièces jointes)."""

    def __init__(self, raise_error: Exception | None = None) -> None:
        self.calls: list[dict] = []
        self.raise_error = raise_error

    def __call__(self, cfg, to_email, subject, html_content, text_content="", attachments=None):
        self.calls.append({
            "cfg": cfg,
            "to_email": to_email,
            "subject": subject,
            "html": html_content,
            "text": text_content,
            "attachments": attachments or [],
        })
        if self.raise_error:
            raise self.raise_error
        return True


def _pdf_texte(pdf: bytes) -> bytes:
    """Extrait le texte des flux compressés (Flate) du PDF produit par fpdf2."""
    texte = b""
    for match in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", pdf, re.S):
        try:
            texte += zlib.decompress(match.group(1))
        except Exception:
            continue
    return texte


def _mot_de_passe_du_pdf(texte: bytes, mot_de_passe_hash: str) -> str | None:
    """Retrouve le mot de passe temporaire inscrit dans le PDF (vérifié contre le hash)."""
    for candidat in re.findall(rb"[A-Za-z0-9!@#$%^&*\-_]{12}", texte):
        mot = candidat.decode("ascii")
        if verify_password(mot, mot_de_passe_hash):
            return mot
    return None


@pytest.fixture
def fake_smtp(monkeypatch):
    """Remplace l'envoi SMTP réel par un doublet capturant (aucun réseau)."""
    fake = _FakeSend()
    monkeypatch.setattr("app.services.email._send_via_config", fake)
    return fake


async def _seed_referentiel(db_session) -> Entreprise:
    """Crée l'entreprise de test + le rôle `client` (résolu par le router)."""
    entreprise = Entreprise(nom="TIA Build Test")
    db_session.add(entreprise)
    await db_session.flush()
    db_session.add(Role(nom="Client", code="client", is_system=True))
    await db_session.flush()
    return entreprise


async def _utilisateur_client(db_session, client_id: int) -> Utilisateur | None:
    result = await db_session.execute(
        select(Utilisateur).where(
            Utilisateur.client_id == client_id,
            Utilisateur.is_deleted == False,  # noqa: E712
        )
    )
    return result.scalars().first()


# --------------------------------------------------------------------------
# 1. Rendu du PDF (unitaire, sans HTTP)
# --------------------------------------------------------------------------

def test_fiche_acces_pdf_contient_identifiants_et_lien():
    client = SimpleNamespace(
        id=7, nom="Rakoto", prenom="Jean", entreprise="BTP SARL",
        email="jean.rakoto@exemple.mg", telephone="0341122233",
        adresse="Lot 12 bis", adresse_complement=None,
        code_postal="101", ville="Antananarivo", pays="Madagascar",
    )
    utilisateur = SimpleNamespace(id=9, email="jean.rakoto@exemple.mg")
    pdf = render_fiche_acces_client_pdf(
        client=client,
        utilisateur=utilisateur,
        entreprise=SimpleNamespace(nom="TIA BTP"),
        temp_password="Ab3!xY9-kL2m",
        login_url="http://localhost:5173/client-login",
    )

    assert pdf.startswith(b"%PDF")
    assert pdf.rstrip().endswith(b"%%EOF")
    assert len(pdf) > 800

    texte = _pdf_texte(pdf)
    assert b"Ab3!xY9-kL2m" in texte
    assert b"jean.rakoto@exemple.mg" in texte
    assert b"client-login" in texte


def test_fiche_acces_pdf_supporte_caracteres_hors_latin1():
    """Aucune exception même avec des caractères typographiques (’ « » —)."""
    client = SimpleNamespace(
        id=8, nom="Rasoa", prenom="Émilie", entreprise="Société « Bâti » — Île",
        email="emilie@exemple.mg", telephone="", adresse="",
        adresse_complement=None, code_postal="", ville="", pays="Madagascar",
    )
    pdf = render_fiche_acces_client_pdf(
        client=client,
        utilisateur=SimpleNamespace(id=10, email="emilie@exemple.mg"),
        entreprise=None,
        temp_password="Xy9-Kl2mAb3!",
        login_url=None,
    )
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 800


# --------------------------------------------------------------------------
# 2. Création d'un client avec email → envoi automatique de la fiche
# --------------------------------------------------------------------------

async def test_creation_client_avec_email_envoie_la_fiche(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        response = await http.post(BASE, json={
            "nom": "Rakoto", "prenom": "Jean", "type": "particulier",
            "email": "jean.rakoto@exemple.mg", "telephone": "0341122233",
        })

    assert response.status_code == 201, response.text
    assert response.headers["x-fiche-access-email-envoye"] == "true"
    assert response.headers["x-fiche-access-email"] == "jean.rakoto@exemple.mg"
    # Le mot de passe n'est plus exposé en en-tête lorsque l'email part correctement.
    assert "x-utilisateur-temppwd" not in response.headers

    client_id = response.json()["id"]
    utilisateur = await _utilisateur_client(db_session, client_id)
    assert utilisateur is not None
    assert utilisateur.email == "jean.rakoto@exemple.mg"
    assert utilisateur.must_change_password is True
    assert utilisateur.role is not None and utilisateur.role.code == "client"

    assert len(fake_smtp.calls) == 1
    envoi = fake_smtp.calls[0]
    assert envoi["to_email"] == "jean.rakoto@exemple.mg"
    assert "Espace Client" in envoi["subject"]

    nom_fichier, contenu, mime = envoi["attachments"][0]
    assert nom_fichier == f"fiche-acces-client-{client_id}.pdf"
    assert mime == "application/pdf"
    assert contenu.startswith(b"%PDF")

    assert "http://localhost:5173/client-login" in envoi["html"]

    # Le mot de passe du PDF est bien celui enregistré (hash vérifié)...
    mot_de_passe = _mot_de_passe_du_pdf(_pdf_texte(contenu), utilisateur.mot_de_passe_hash)
    assert mot_de_passe is not None
    # ... et il n'apparaît jamais en clair dans le corps de l'email.
    assert mot_de_passe not in envoi["html"]
    assert mot_de_passe not in envoi["text"]


async def test_creation_client_sans_email_n_envoie_rien(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        response = await http.post(BASE, json={"nom": "Rasoa", "type": "particulier"})

    assert response.status_code == 201, response.text
    assert response.headers["x-fiche-access-email-envoye"] == "false"
    assert response.headers["x-fiche-access-email"] == ""
    assert "x-utilisateur-temppwd" not in response.headers
    assert fake_smtp.calls == []
    assert await _utilisateur_client(db_session, response.json()["id"]) is None


async def test_creation_client_reussit_si_smtp_echoue(db_session, client_factory, monkeypatch):
    entreprise = await _seed_referentiel(db_session)
    fake = _FakeSend(raise_error=ConnectionRefusedError("SMTP indisponible"))
    monkeypatch.setattr("app.services.email._send_via_config", fake)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        response = await http.post(BASE, json={
            "nom": "Randria", "type": "particulier", "email": "randria@exemple.mg",
        })

    assert response.status_code == 201, response.text
    assert response.headers["x-fiche-access-email-envoye"] == "false"
    # Repli manuel : le mot de passe et l'id du compte restent accessibles à l'admin.
    assert response.headers["x-utilisateur-temppwd"]
    assert response.headers["x-utilisateur-cree"]

    utilisateur = await _utilisateur_client(db_session, response.json()["id"])
    assert utilisateur is not None
    assert verify_password(response.headers["x-utilisateur-temppwd"], utilisateur.mot_de_passe_hash)



# --------------------------------------------------------------------------
# 3. Renvoi des identifiants
# --------------------------------------------------------------------------

async def test_renvoyer_identifiants_regenere_un_mot_de_passe(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        creation = await http.post(BASE, json={
            "nom": "Rakoto", "type": "particulier", "email": "rakoto@exemple.mg",
        })
        assert creation.status_code == 201, creation.text
        client_id = creation.json()["id"]
        utilisateur = await _utilisateur_client(db_session, client_id)
        ancien_hash = utilisateur.mot_de_passe_hash
        fake_smtp.calls.clear()

        renvoi = await http.post(f"{BASE}/{client_id}/envoyer-identifiants")

    assert renvoi.status_code == 200, renvoi.text
    corps = renvoi.json()
    assert corps["email_envoye"] is True
    assert corps["email"] == "rakoto@exemple.mg"
    assert corps["client_id"] == client_id

    assert len(fake_smtp.calls) == 1
    nom_fichier, contenu, mime = fake_smtp.calls[0]["attachments"][0]
    assert nom_fichier == f"fiche-acces-client-{client_id}.pdf"
    assert mime == "application/pdf"

    await db_session.refresh(utilisateur)
    assert utilisateur.mot_de_passe_hash != ancien_hash
    assert utilisateur.must_change_password is True
    nouveau = _mot_de_passe_du_pdf(_pdf_texte(contenu), utilisateur.mot_de_passe_hash)
    assert nouveau is not None
    assert not verify_password(nouveau, ancien_hash)


async def test_renvoyer_identifiants_client_sans_email_400(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        creation = await http.post(BASE, json={"nom": "SansMail", "type": "particulier"})
        client_id = creation.json()["id"]
        renvoi = await http.post(f"{BASE}/{client_id}/envoyer-identifiants")

    assert renvoi.status_code == 400
    assert "adresse email" in renvoi.json()["detail"]
    assert fake_smtp.calls == []


# --------------------------------------------------------------------------
# 4. Téléchargement de la fiche + garde-fous RBAC
# --------------------------------------------------------------------------

async def test_telecharger_fiche_acces(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        creation = await http.post(BASE, json={
            "nom": "Rakoto", "type": "particulier", "email": "rakoto2@exemple.mg",
        })
        client_id = creation.json()["id"]
        telechargement = await http.get(
            f"{BASE}/{client_id}/fiche-acces",
            params={"login_url": "http://localhost:5173/client-login"},
        )

    assert telechargement.status_code == 200, telechargement.text
    assert telechargement.headers["content-type"].startswith("application/pdf")
    assert f'filename="fiche-acces-client-{client_id}.pdf"' in telechargement.headers["content-disposition"]
    assert telechargement.content.startswith(b"%PDF")
    assert b"client-login" in _pdf_texte(telechargement.content)


async def test_acces_refuse_si_permission_insuffisante(db_session, client_factory, fake_smtp):
    entreprise = await _seed_referentiel(db_session)

    async with await client_factory("commercial", entreprise_id=entreprise.id) as http:
        creation = await http.post(BASE, json={
            "nom": "Rakoto", "type": "particulier", "email": "rakoto3@exemple.mg",
        })
        assert creation.status_code == 201, creation.text
        client_id = creation.json()["id"]

    # Un rôle sans droit commercial ne peut pas créer de client.
    async with await client_factory("rh", entreprise_id=entreprise.id) as http:
        assert (await http.post(BASE, json={"nom": "Interdit"})).status_code == 403

    # Un rôle en lecture seule ne peut ni télécharger ni renvoyer les identifiants.
    async with await client_factory("directeur", entreprise_id=entreprise.id) as http:
        assert (await http.get(f"{BASE}/{client_id}/fiche-acces")).status_code == 403
        assert (await http.post(f"{BASE}/{client_id}/envoyer-identifiants")).status_code == 403

