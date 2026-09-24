"""
Script d'initialisation de la base de données TIA INFO BUILD.
- Applique les migrations Alembic
- Crée les rôles système
- Crée un super admin et une entreprise de test

Usage:
    python -m app.scripts.init_db
    ou
    python app/scripts/init_db.py
"""
import asyncio
import sys
import os

# Ajouter le dossier parent dans sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import text, select
from app.database import engine, AsyncSessionLocal
from app.security import hash_password


ROLES_SYSTEME = [
    {"id": 1, "nom": "Super Administrateur", "code": "super_admin", "description": "Propriétaire plateforme SaaS", "is_system": True},
    {"id": 2, "nom": "Administrateur Entreprise", "code": "admin_entreprise", "description": "Gestion technique et sécurité tenant", "is_system": True},
    {"id": 3, "nom": "Direction Générale", "code": "directeur", "description": "Pilotage stratégique et validations DAF", "is_system": True},
    {"id": 4, "nom": "Chef de Chantier", "code": "chef_chantier", "description": "Suivi terrain, pointage équipe et avancement", "is_system": True},
    {"id": 5, "nom": "Chef de Projet", "code": "chef_projet", "description": "Supervision multi-chantiers et arbitrage", "is_system": True},
    {"id": 6, "nom": "Comptable / Financier", "code": "comptable", "description": "Gestion financière et trésorerie", "is_system": True},
    {"id": 7, "nom": "Responsable RH", "code": "rh", "description": "Gestion des ressources humaines et paie", "is_system": True},
    {"id": 8, "nom": "Responsable Matériel", "code": "materiel", "description": "Gestion du parc engins et maintenance", "is_system": True},
    {"id": 9, "nom": "Magasinier", "code": "magasinier", "description": "Gestion des stocks et entrepôts", "is_system": True},
    {"id": 10, "nom": "Commercial", "code": "commercial", "description": "Gestion clients et rédaction des devis", "is_system": True},
    {"id": 11, "nom": "Employé / Ouvrier", "code": "employe", "description": "Exécution terrain et tâches", "is_system": True},
    {"id": 12, "nom": "Client", "code": "client", "description": "Accès lecture devis/factures", "is_system": True},
]

ENTREPRISE_TEST = {
    "nom": "BTP PRO MADAGASCAR",
    "nom_commercial": "BTP PRO",
    "adresse": "Ivandry, Antananarivo",
    "code_postal": "101",
    "ville": "Antananarivo",
    "telephone": "034 00 000 00",
    "email": "contact@btppro.mg",
    "abonnement": "premium",
    "devise": "MGA",
    "prefixe_devis": "DEV",
    "prefixe_facture": "FAC",
    "prefixe_contrat": "CTR",
    "tva_defaut": 20.0,
    "delai_paiement_defaut": 30,
    "validite_devis": 30,
    "actif": True,
}

SUPER_ADMIN = {
    "email": "admin@tia.mg",
    "nom": "ADMINISTRATEUR",
    "prenom": "Super",
    "statut": "actif",
    "must_change_password": False,
    "role_id": 1,
}

ADMIN_ENTREPRISE = {
    "email": "demo@btppro.mg",
    "nom": "RAMAROSON",
    "prenom": "Hery",
    "statut": "actif",
    "must_change_password": False,
    "role_id": 2,
}

MOT_DE_PASSE_DEMO = "Admin123!"

PLANS_DEFAUT = [
    # Plan système d'essai : requis par demarrer_essai() à chaque inscription entreprise.
    # Ne pas le renommer ni le supprimer. Indestructible (409 côté API).
    {"nom": "Gratuit — Essai 30 jours", "code": "essai", "description": "Accès complet pendant 30 jours : toutes les fonctionnalités, 10 employés, clients illimités.", "prix_mensuel": 0, "prix_annuel": 0, "utilisateurs_max": 10, "chantiers_max": 5, "duree_essai_jours": 30, "actif": 1},
    # Plan gratuit permanent : filet de sécurité (entreprises sans abonnement, backfill).
    {"nom": "Gratuit", "code": "gratuit", "description": "Formule gratuite permanente : 10 employés, clients illimités.", "prix_mensuel": 0, "prix_annuel": 0, "utilisateurs_max": 10, "chantiers_max": 3, "duree_essai_jours": 0, "actif": 1},
    # Les formules payantes (Starter / Pro / Business…) se créent et se règlent
    # librement depuis l'interface Super Admin > Abonnements (vrai CRUD).
]


async def seed():
    print("[SEED] Démarrage du seed de la base de données...")

    async with AsyncSessionLocal() as db:
        # 1. Insérer les rôles (ignorer si déjà présents)
        print(" Création des rôles système...")
        for role in ROLES_SYSTEME:
            await db.execute(text("""
                INSERT IGNORE INTO roles (id, nom, code, description, is_system)
                VALUES (:id, :nom, :code, :description, :is_system)
            """), role)

        # 2. Créer l'entreprise de test
        print(" Création de l'entreprise de test...")
        result = await db.execute(text(
            "SELECT id FROM entreprises WHERE nom = :nom LIMIT 1"
        ), {"nom": ENTREPRISE_TEST["nom"]})
        ent = result.fetchone()
        if not ent:
            await db.execute(text("""
                INSERT INTO entreprises (nom, nom_commercial, adresse, code_postal, ville, telephone, email,
                    abonnement, devise, prefixe_devis, prefixe_facture, prefixe_contrat,
                    tva_defaut, delai_paiement_defaut, validite_devis, actif)
                VALUES (:nom, :nom_commercial, :adresse, :code_postal, :ville, :telephone, :email,
                    :abonnement, :devise, :prefixe_devis, :prefixe_facture, :prefixe_contrat,
                    :tva_defaut, :delai_paiement_defaut, :validite_devis, :actif)
            """), ENTREPRISE_TEST)
            result = await db.execute(text(
                "SELECT id FROM entreprises WHERE nom = :nom LIMIT 1"
            ), {"nom": ENTREPRISE_TEST["nom"]})
            ent = result.fetchone()

        entreprise_id = ent[0]
        print(f"    Entreprise ID: {entreprise_id}")

        # 3. Seed des plans d'abonnement (essai + gratuit uniquement ; le reste se
        # gère via le CRUD Super Admin). INSERT IGNORE : ne réveille pas les existants.
        print(" Creation des plans d'abonnement (essai + gratuit)...")
        for plan in PLANS_DEFAUT:
            await db.execute(text("""
                INSERT IGNORE INTO plans (nom, code, description, prix_mensuel, prix_annuel,
                    utilisateurs_max, chantiers_max, stockage_go, duree_essai_jours, actif)
                VALUES (:nom, :code, :description, :prix_mensuel, :prix_annuel,
                    :utilisateurs_max, :chantiers_max, 5, :duree_essai_jours, :actif)
            """), plan)

        # 3. Créer le super admin (entreprise_id = NULL)
        print(" Creation du super admin...")
        result = await db.execute(text(
            "SELECT id FROM utilisateurs WHERE email = :email LIMIT 1"
        ), {"email": SUPER_ADMIN["email"]})
        if not result.fetchone():
            await db.execute(text("""
                INSERT INTO utilisateurs (email, nom, prenom, mot_de_passe_hash, statut, must_change_password, role_id)
                VALUES (:email, :nom, :prenom, :hash, :statut, :must_change_password, :role_id)
            """), {**SUPER_ADMIN, "hash": hash_password(MOT_DE_PASSE_DEMO)})
            print(f"    Super admin: {SUPER_ADMIN['email']} / {MOT_DE_PASSE_DEMO}")
        else:
            print(f"    Super admin deja existant: {SUPER_ADMIN['email']}")

                # 4. Créer l'admin entreprise
        print(" Creation de l'admin entreprise...")
        result = await db.execute(text(
            "SELECT id FROM utilisateurs WHERE email = :email LIMIT 1"
        ), {"email": ADMIN_ENTREPRISE["email"]})
        if not result.fetchone():
            await db.execute(text("""
                INSERT INTO utilisateurs (email, nom, prenom, mot_de_passe_hash, statut, must_change_password, role_id, entreprise_id)
                VALUES (:email, :nom, :prenom, :hash, :statut, :must_change_password, :role_id, :entreprise_id)
            """), {**ADMIN_ENTREPRISE, "hash": hash_password(MOT_DE_PASSE_DEMO), "entreprise_id": entreprise_id})
            print(f"    Admin entreprise: {ADMIN_ENTREPRISE['email']} / {MOT_DE_PASSE_DEMO}")
        else:
            print(f"    Admin entreprise deja existant: {ADMIN_ENTREPRISE['email']}")

        # 4b. Créer les comptes de test pour chaque rôle métier de l'entreprise
        print(" Creation des comptes de test par role...")
        TEST_ACCOUNTS = [
            (3,  "directeur@btppro.mg",      "Direction",  "Jean",     "directeur"),
            (6,  "comptable@btppro.mg",      "Comptable",  "Marie",    "comptable"),
            (5,  "chefprojet@btppro.mg",     "ChefProjet", "Ahmed",    "chef_projet"),
            (4,  "chefchantier@btppro.mg",   "ChefChantier","Bruno",   "chef_chantier"),
            (7,  "rh@btppro.mg",             "RH",         "Claire",   "rh"),
            (8,  "materiel@btppro.mg",       "Materiel",   "David",    "materiel"),
            (9,  "magasinier@btppro.mg",     "Magasinier", "Elsa",     "magasinier"),
            (10, "commercial@btppro.mg",     "Commercial", "Frank",    "commercial"),
            (11, "ouvrier@btppro.mg",        "Ouvrier",    "Gilbert",  "employe"),
            (11, "employe@btppro.mg",        "Employe",    "Gerard",   "employe"),
            (12, "client@btppro.mg",         "Client",     "Hugo",     "client"),
        ]
        for role_id, email, nom, prenom, code in TEST_ACCOUNTS:
            result = await db.execute(text(
                "SELECT id FROM utilisateurs WHERE email = :email LIMIT 1"
            ), {"email": email})
            if not result.fetchone():
                await db.execute(text("""
                    INSERT INTO utilisateurs (email, nom, prenom, mot_de_passe_hash, statut, must_change_password, role_id, entreprise_id)
                    VALUES (:email, :nom, :prenom, :hash, :statut, :must_change_password, :role_id, :entreprise_id)
                """), {
                    "email": email, "nom": nom, "prenom": prenom,
                    "hash": hash_password(MOT_DE_PASSE_DEMO),
                    "statut": "actif", "must_change_password": False,
                    "role_id": role_id, "entreprise_id": entreprise_id,
                })
                print(f"    Compte {code}: {email} / {MOT_DE_PASSE_DEMO}")
            else:
                print(f"    Compte {code} deja existant: {email}")

        # 4c. Correction des role_id inverses (comptable/chef_chantier) pour les comptes existants
        await db.execute(text("UPDATE utilisateurs SET role_id=6 WHERE email='comptable@btppro.mg' AND role_id=4"))
        await db.execute(text("UPDATE utilisateurs SET role_id=4 WHERE email='chefchantier@btppro.mg' AND role_id=6"))
        await db.commit()
        print("    Role_id comptable/chef_corriges si necessaire")

        # 4c-bis. Fiches employes de demo (badge QR d'identite rattache aux comptes
        # utilisateurs par email ; le pointage est fait par le chef de chantier / RH
        # via le scan de ce badge)
        print("    Seed fiches employes demo...")
        EMPLOYES_DEMO = [
            ("ouvrier@btppro.mg", "Ouvrier", "Gilbert", "Ouvrier polyvalent"),
            ("employe@btppro.mg", "Employe", "Gerard", "Employe de terrain"),
        ]
        for email_e, nom_e, prenom_e, poste_e in EMPLOYES_DEMO:
            result = await db.execute(text(
                "SELECT id FROM employes WHERE email = :email AND is_deleted = 0 LIMIT 1"
            ), {"email": email_e})
            if not result.fetchone():
                await db.execute(text("""
                    INSERT INTO employes (entreprise_id, nom, prenom, poste, email, statut)
                    VALUES (:eid, :nom, :prenom, :poste, :email, 'actif')
                """), {"eid": entreprise_id, "nom": nom_e, "prenom": prenom_e, "poste": poste_e, "email": email_e})
                print(f"      Fiche employe creee: {email_e}")
            else:
                print(f"      Fiche employe deja existante: {email_e}")
        await db.commit()

        # 4c-ter. Seed espace employe terrain : chantier demo, affectations, tâches
        print("    Seed espace employe terrain...")
        # Chantier demo si aucun existant
        r = await db.execute(text(
            "SELECT id FROM chantiers WHERE entreprise_id = :eid AND is_deleted = 0 LIMIT 1"
        ), {"eid": entreprise_id})
        chantier_demo_id = r.fetchone()
        if not chantier_demo_id:
            await db.execute(text("""
                INSERT INTO chantiers (entreprise_id, numero, nom, adresse, ville, date_debut, statut, description)
                VALUES (:eid, 'CHANT-2026-001', 'Chantier Demo Anosy', 'Anosy, Antananarivo', 'Antananarivo', CURDATE(), 'en_cours', 'Chantier de demonstration Espace Employe Terrain')
            """), {"eid": entreprise_id})
            r = await db.execute(text(
                "SELECT id FROM chantiers WHERE entreprise_id = :eid AND is_deleted = 0 LIMIT 1"
            ), {"eid": entreprise_id})
            chantier_demo_id = r.fetchone()
            print(f"      Chantier demo cree (ID {chantier_demo_id[0]})")
        if chantier_demo_id:
            chantier_id_demo = chantier_demo_id[0]
            # Lien demo projet -> chantier (workflow transformation) si un projet demo existe
            r = await db.execute(text(
                "SELECT id FROM projets WHERE entreprise_id = :eid AND is_deleted = 0 LIMIT 1"
            ), {"eid": entreprise_id})
            row_proj = r.fetchone()
            if row_proj:
                r = await db.execute(text(
                    "UPDATE chantiers SET projet_id = :pid WHERE id = :cid AND projet_id IS NULL"
                ), {"pid": row_proj[0], "cid": chantier_id_demo})
                # Lier les devis existants au projet demo pour le workflow transformation
                await db.execute(text(
                    "UPDATE devis SET projet_id = :pid WHERE entreprise_id = :eid AND projet_id IS NULL AND is_deleted = 0 LIMIT 1"
                ), {"pid": row_proj[0], "eid": entreprise_id})
            # Affectations des employes demo au chantier
            for email_e in ("ouvrier@btppro.mg", "employe@btppro.mg"):
                r = await db.execute(text(
                    "SELECT id FROM employes WHERE email = :email AND is_deleted = 0 LIMIT 1"
                ), {"email": email_e})
                row_emp = r.fetchone()
                if row_emp:
                    rid = row_emp[0]
                    r = await db.execute(text(
                        "SELECT id FROM affectation_chantiers WHERE employe_id = :emp AND chantier_id = :ch AND is_deleted = 0 LIMIT 1"
                    ), {"emp": rid, "ch": chantier_id_demo})
                    if not r.fetchone():
                        await db.execute(text("""
                            INSERT INTO affectation_chantiers (employe_id, chantier_id, date_debut, role)
                            VALUES (:emp, :ch, CURDATE(), 'Ouvrier')
                        """), {"emp": rid, "ch": chantier_id_demo})
                        print(f"      Affectation creee: {email_e} -> chantier {chantier_id_demo}")
            # Taches de demo
            r = await db.execute(text(
                "SELECT id FROM employes WHERE email = 'ouvrier@btppro.mg' AND is_deleted = 0 LIMIT 1"
            ), {})
            emp_ow = r.fetchone()
            if emp_ow:
                r = await db.execute(text(
                    "SELECT id FROM taches WHERE employe_id = :emp AND is_deleted = 0 LIMIT 1"
                ), {"emp": emp_ow[0]})
                if not r.fetchone():
                    for t in [
                        ("Coffrage dalle", "Gros oeuvre", "Realiser le coffrage de la dalle zone A", "normale"),
                        ("Ferralage", "Gros oeuvre", "Ferralier les semelles zone A", "haute"),
                    ]:
                        await db.execute(text("""
                            INSERT INTO taches (entreprise_id, chantier_id, employe_id, ouvrage, titre, description, date_prevue, priorite, statut)
                            VALUES (:eid, :ch, :emp, :ouvrage, :titre, :desc, CURDATE(), :prio, 'a_faire')
                        """), {
                            "eid": entreprise_id, "ch": chantier_id_demo, "emp": emp_ow[0],
                            "ouvrage": t[1], "titre": t[0], "desc": t[2], "prio": t[3],
                        })
                    print("      Taches demo creees")
        await db.commit()
        print("    Seed donnees module commercial...")
        result = await db.execute(text("SELECT id FROM clients WHERE entreprise_id = :eid LIMIT 1"), {"eid": entreprise_id})
        client_row = result.fetchone()
        client_id = client_row[0] if client_row else None

        # Créer la fiche client de démo si absente (nécessaire au seed commercial
        # et pour rattacher le compte utilisateur client@btppro.mg à des données)
        if not client_id:
            await db.execute(text("""
                INSERT INTO clients (entreprise_id, type, civilite, nom, prenom, email, telephone, adresse, ville)
                VALUES (:eid, 'particulier', 'M', 'RAKOTO', 'Jean', 'client@btppro.mg', '034 00 000 01', 'Lot II M 45, Ivandry', 'Antananarivo')
            """), {"eid": entreprise_id})
            result = await db.execute(text("SELECT id FROM clients WHERE entreprise_id = :eid LIMIT 1"), {"eid": entreprise_id})
            client_id = result.fetchone()[0]
            print(f"      Fiche client demo creee (ID {client_id}, client@btppro.mg)")

        # Lier le compte utilisateur client@btppro.mg a sa fiche client (Espace Client)
        await db.execute(text(
            "UPDATE utilisateurs u JOIN clients c ON c.email = u.email "
            "SET u.client_id = c.id WHERE u.email = 'client@btppro.mg' AND u.client_id IS NULL"
        ))

        if client_id:
            # Vérifier si des demandes existent déjà
            result = await db.execute(text("SELECT COUNT(*) FROM demandes_travaux WHERE entreprise_id = :eid"), {"eid": entreprise_id})
            if result.fetchone()[0] == 0:
                # Créer une demande de travaux
                await db.execute(text("""
                    INSERT INTO demandes_travaux (entreprise_id, client_id, numero, objet, type_projet, description, localisation, statut)
                    VALUES (:eid, :cid, 'DEM-00001', 'Construction maison R+1', 'construction', 'Construction d''une maison rez-de-chaussée + 1 étage', 'Antananarivo, Anosy', 'en_etude')
                """), {"eid": entreprise_id, "cid": client_id})
                print("      Demande DEM-00001 creee")

                # Créer un projet
                await db.execute(text("""
                    INSERT INTO projets (entreprise_id, client_id, reference, nom, type_projet, description, localisation, surface, statut)
                    VALUES (:eid, :cid, 'PRJ-00001', 'Projet Maison Anosy', 'construction', 'Construction maison R+1, 150m2', 'Antananarivo, Anosy', 150, 'en_etude')
                """), {"eid": entreprise_id, "cid": client_id})
                print("      Projet PRJ-00001 cree")

                # Créer des métrés
                metres_data = [
                    ('Terrassement général', 'm3', 100),
                    ('Béton de fondation', 'm3', 25),
                    ('Élévation des murs', 'm2', 250),
                    ('Charpente bois', 'm2', 150),
                    ('Couverture tôles', 'm2', 160),
                ]
                for i, (ouvrage, unite, quantite) in enumerate(metres_data):
                    await db.execute(text("""
                        INSERT INTO metres (entreprise_id, ouvrage, unite, quantite, ordre)
                        VALUES (:eid, :ouvrage, :unite, :quantite, :ordre)
                    """), {"eid": entreprise_id, "ouvrage": ouvrage, "unite": unite, "quantite": quantite, "ordre": i})
                print(f"      {len(metres_data)} lignes de metre creees")

                # Créer une situation de travaux
                await db.execute(text("""
                    INSERT INTO situations_travaux (entreprise_id, numero, periode, avancement, montant, statut)
                    VALUES (:eid, 'SIT-00001', 'Janvier 2026', 35.00, 15000000, 'validee')
                """), {"eid": entreprise_id})
                print("      Situation SIT-00001 creee")

        await db.commit()
        print("    Seed commercial termine")

        # 5. Créer un abonnement par défaut pour l'entreprise de test (plan Pro)
        print(" Creation de l'abonnement par defaut...")
        result = await db.execute(text(
            "SELECT id FROM plans WHERE code = :code LIMIT 1"
        ), {"code": "pro"})
        plan_row = result.fetchone()
        if plan_row:
            plan_id = plan_row[0]
            result = await db.execute(text(
                "SELECT id FROM subscriptions WHERE entreprise_id = :eid LIMIT 1"
            ), {"eid": entreprise_id})
            if not result.fetchone():
                await db.execute(text("""
                    INSERT INTO subscriptions (entreprise_id, plan_id, date_debut, date_fin, date_prochain_renouvellement, statut, periode)
                    VALUES (:eid, :pid, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 30 DAY), 'actif', 'mensuel')
                """), {"eid": entreprise_id, "pid": plan_id})
                print(f"    Abonnement Pro créé pour l'entreprise ID {entreprise_id}")

        await db.commit()

    print("\n Seed terminé avec succès !")
    print("\n Comptes de connexion créés:")
    print(f"   Super Admin  : {SUPER_ADMIN['email']} / {MOT_DE_PASSE_DEMO}")
    print(f"   Admin Entrep.: {ADMIN_ENTREPRISE['email']} / {MOT_DE_PASSE_DEMO}")
    print("\n Vous pouvez maintenant démarrer le serveur: uvicorn app.main:app --reload")


if __name__ == "__main__":
    asyncio.run(seed())
