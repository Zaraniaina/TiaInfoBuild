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
    {"id": 11, "nom": "Employé / Ouvrier", "code": "employe", "description": "Exécution terrain, tâches et pointage", "is_system": True},
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
    {"nom": "Essai Gratuit", "code": "essai", "description": "Accès complet 30 jours", "prix_mensuel": 1, "prix_annuel": 1, "utilisateurs_max": 2, "chantiers_max": 1, "stockage_go": 1, "duree_essai_jours": 30, "actif": 1},
    {"nom": "Starter", "code": "starter", "description": "Pour les petites entreprises", "prix_mensuel": 15000, "prix_annuel": 150000, "utilisateurs_max": 5, "chantiers_max": 3, "stockage_go": 10, "duree_essai_jours": 30, "actif": 1},
    {"nom": "Pro", "code": "pro", "description": "Le plus populaire", "prix_mensuel": 40000, "prix_annuel": 400000, "utilisateurs_max": 20, "chantiers_max": 10, "stockage_go": 50, "duree_essai_jours": 30, "actif": 1},
    {"nom": "Business", "code": "business", "description": "Entreprises établies", "prix_mensuel": 100000, "prix_annuel": 1000000, "utilisateurs_max": 50, "chantiers_max": 25, "stockage_go": 200, "duree_essai_jours": 30, "actif": 1},
    {"nom": "Enterprise", "code": "enterprise", "description": "Sur devis", "prix_mensuel": 1, "prix_annuel": 1, "utilisateurs_max": 999, "chantiers_max": 999, "stockage_go": 999, "duree_essai_jours": 30, "actif": 1},
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

        # 3. Seed des plans d'abonnement
        print(" Creation des plans d'abonnement...")
        for plan in PLANS_DEFAUT:
            await db.execute(text("""
                INSERT IGNORE INTO plans (nom, code, description, prix_mensuel, prix_annuel,
                    utilisateurs_max, chantiers_max, stockage_go, duree_essai_jours, actif)
                VALUES (:nom, :code, :description, :prix_mensuel, :prix_annuel,
                    :utilisateurs_max, :chantiers_max, :stockage_go, :duree_essai_jours, :actif)
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
