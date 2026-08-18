"""
Script de migration des données du Desktop (SQLite) vers la Web (MySQL).
Usage: python app/scripts/migrate_sqlite.py
    --sqlite ../../Desktop/tia_info_build.sqlite
    --target mysql+aiomysql://tia_user:tia_password@localhost:3306/tia_build_db

Étapes:
1. Lire le fichier SQLite Desktop
2. Transformer les données (camelCase → snake_case, rôles, soft delete)
3. Insérer dans MySQL via transactions
4. Logs détaillés + rollback en cas d'erreur
"""

import argparse
import sqlite3
import aiomysql
import asyncio
import json
import logging
from datetime import datetime
from typing import Any
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

logger = logging.getLogger(__name__)

# Mapping des rôles Desktop → Web
ROLE_MAPPING = {
    "super_admin": "super_admin",
    "admin": "admin_entreprise",
    "commercial": "commercial",
    "chef_chantier": "chef_chantier",
    "technicien": "chef_chantier",  # Regroupé
    "employe": "employe",
    "client": "client",
}

# Mapping des tables Desktop → Web
TABLE_MAPPING = {
    "Utilisateur": "utilisateurs",
    "Role": "roles",
    "Chantier": "chantiers",
    "Phase": "phases",
    "Employe": "employes",
    "Pointage": "pointages",
    "HeureSupplementaire": "heures_supplementaires",
    "Equipe": "equipes",
    "MembreEquipe": "membres_equipe",
    "Article": "articles",
    "MouvementStock": "mouvements_stock",
    "Fournisseur": "fournisseurs",
    "Client": "clients",
    "ClientAdresse": "client_adresses",
    "Devis": "devis",
    "LigneDevis": "lignes_devis",
    "Contrat": "contrats",
    "Facture": "factures",
    "Paiement": "paiements",
    "Depense": "depenses",
    "Alerte": "alertes",
    "Materiel": "materiaux",
    "Maintenance": "maintenances",
    "HistoriquePoste": "historique_postes",
    "SyncQueue": "sync_queue",
}

# Mapping des colonnes camelCase → snake_case (Desktop → Web)
COLUMN_MAPPING = {
    "entrepriseId": "entreprise_id",
    "roleId": "role_id",
    "chatierId": "chantier_id",
    "client_id": "client_id",
    "chefChantierId": "chef_chantier_id",
    "dateDebut": "date_debut",
    "dateFin": "date_fin",
    "dateFinPrevue": "date_fin_prevue",
    "dateFinReelle": "date_fin_reelle",
    "dateEcheance": "date_echeance",
    "dateEmission": "date_emission",
    "dateCreation": "date_creation",
    "dateMouvement": "date_mouvement",
    "datePaiement": "date_paiement",
    "dateDepense": "date_depense",
    "dateSignature": "date_signature",
    "dateMaintenance": "date_maintenance",
    "dateAcquisition": "date_acquisition",
    "dateAlerte": "date_alerte",
    "dateLecture": "date_lecture",
    "dateConnexion": "date_connexion",
    "dateJour": "date_jour",
    "dateHS": "date_hs",
    "dateGenration": "date_generation",
    "budgetPrevu": "budget_prevu",
    "budgetReel": "budget_reel",
    "budgetPrevisionnel": "budget_previsionnel",
    "margeCible": "marge_cible",
    "montantHT": "montant_ht",
    "montantTTC": "montant_ttc",
    "montantPaye": "montant_paye",
    "tauxTVA": "taux_tva",
    "tauxMajoration": "taux_majoration",
    "nbHeures": "nb_heures",
    "typeCompensation": "type_compensation",
    "salaireBase": "salaire_base",
    "dateEmbauche": "date_embauche",
    "dateDebutContrat": "date_debut_contrat",
    "dateFinContrat": "date_fin_contrat",
    "typeContrat": "type_contrat",
    "numeroSerie": "numero_serie",
    "valeurAchat": "valeur_achat",
    "dateAcquisition": "date_acquisition",
    "prochaineDateEcheance": "prochaine_date_echeance",
    "stockActuel": "stock_actuel",
    "seuilAlerte": "seuil_alerte",
    "stockMini": "stock_mini",
    "prixAchat": "prix_achat",
    "prixVente": "prix_vente",
    "codeBarre": "code_barre",
    "numeroT VA": "numero_tva",
    "codeAPE": "code_ape",
    "siteWeb": "site_web",
    "dateValidite": "date_validite",
    "conditionsPaiement": "conditions_paiement",
    "modePaiement": "mode_paiement",
    "numeroFacture": "numero_facture",
    "valideePar": "validee_par",
    "garantieMois": "garantie_mois",
    "typeEntite": "type_entite",
    "entiteId": "entite_id",
    "niveauGravite": "niveau_gravite",
    "dateGeneration": "date_generation",
    "chiffreAffaires": "chiffre_affaires",
    "depensesTotal": "depenses_total",
    "adresseComplement": "adresse_complement",
    "codePostal": "code_postal",
    "dateDebut": "date_debut",
    "dateFin": "date_fin",
    "nbDevis": "nb_devis",
    "nbFactures": "nb_factures",
    "caTotal": "ca_total",
    "dernierContact": "dernier_contact",
    "encoursMax": "encours_max",
    "encoursActuel": "encours_actuel",
    "motDePasseHash": "mot_de_passe_hash",
    "dateCreation": "created_at",
    "dateCreated": "created_at",
    "is_deleted": "is_deleted",
    "isSynced": "is_synced",
    "typeMouvement": "type_mouvement",
    "prixUnitaire": "prix_unitaire",
    "totalHT": "total_ht",
    "totalTTC": "total_ttc",
    "quantite": "quantite",
    "remise": "remise",
    "unite": "unite",
    "description": "description",
    "notes": "notes",
    "statut": "statut",
    "photo": "photo",
    "civilite": "civilite",
    "telephone": "telephone",
    "portable": "portable",
    "email": "email",
    "adresse": "adresse",
    "ville": "ville",
    "pays": "pays",
    "siret": "siret",
    "reference": "reference",
    "objet": "objet",
    "motif": "motif",
    "numero": "numero",
    "typeContrat": "type_contrat",
    "type": "type",
    "operation": "operation",
    "payload": "payload",
    "status": "status",
    "retryCount": "retry_count",
    "errorMessage": "error_message",
    "tableName": "table_name",
    "recordId": "record_id",
    "serverId": "server_id",
    "message": "message",
    "titre": "titre",
    "dateCreation": "created_at",
    "dateFin": "date_fin",
    "dateDebut": "date_debut",
    "dateMois": "date_mois",
    "taux": "taux",
    "prixUnitaire": "prix_unitaire",
    "reference": "reference",
    "banque": "banque",
    "refence": "reference",
}

IGNORED_COLUMNS = {"server_id", "isSynced"}


def map_columns(row: dict, mapping: dict) -> dict:
    """Transforme un dictionnaire camelCase en snake_case."""
    result = {}
    for key, value in row.items():
        snake_key = mapping.get(key, key)
        if snake_key in IGNORED_COLUMNS:
            continue
        if isinstance(value, str):
            value = value.strip() if value else value
        result[snake_key] = value
    return result


def map_role_code(role_code: str) -> str:
    """Mappe le code rôle Desktop → Web."""
    return ROLE_MAPPING.get(role_code, role_code)


async def run_migration(sqlite_path: str, mysql_url: str) -> dict:
    """Exécute la migration complète SQLite → MySQL."""

    # Connexion SQLite
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    # Connexion MySQL
    engine = create_async_engine(mysql_url, echo=False)
    async_session = AsyncSession(engine)

    stats = {
        "tables_processed": 0,
        "total_records": 0,
        "errors": [],
        "by_table": {},
    }

    try:
        # 1. Migrer les rôles
        logger.info("Migration des rôles...")
        cursor = sqlite_conn.cursor()

        cursor.execute("SELECT * FROM Role")
        roles = cursor.fetchall()

        for role_row in roles:
            role_dict = dict(role_row)
            # Vérifier si le rôle existe déjà dans MySQL
            web_code = map_role_code(role_dict.get("code", ""))
            existing = await async_session.execute(
                text("SELECT id FROM roles WHERE code = :code"),
                {"code": web_code},
            )
            if existing.fetchone():
                logger.info(f"Rôle '{web_code}' existe déjà, ignoré")
                continue

            await async_session.execute(
                text(
                    "INSERT INTO roles (nom, description, code, permissions, is_system, created_at, updated_at) "
                    "VALUES (:nom, :description, :code, :permissions, :is_system, NOW(), NOW())"
                ),
                {
                    "nom": role_dict.get("nom", ""),
                    "description": role_dict.get("description", ""),
                    "code": web_code,
                    "permissions": json.dumps(role_dict.get("permissions", {})),
                    "is_system": role_dict.get("isSystem", False),
                },
            )
            stats["by_table"]["roles"] = stats["by_table"].get("roles", 0) + 1

        await async_session.commit()
        logger.info("Rôles migrés avec succès")

        # 2. Migrer les entreprises
        logger.info("Migration des entreprises...")
        cursor.execute("SELECT * FROM Entreprise")
        entreprises = cursor.fetchall()

        for ent_row in entreprises:
            ent_dict = map_columns(dict(ent_row), COLUMN_MAPPING)
            # Vérifier si existe déjà
            existing = await async_session.execute(
                text("SELECT id FROM entreprises WHERE nom = :nom"),
                {"nom": ent_dict.get("nom")},
            )
            if existing.fetchone():
                continue

            await async_session.execute(
                text(
                    "INSERT INTO entreprises "
                    "(nom, nom_commercial, adresse, code_postal, ville, telephone, email, logo, "
                    "abonnement, devise, siret, numero_tva, code_ape, site_web, prefixe_devis, "
                    "prefixe_facture, prefixe_contrat, tva_defaut, delai_paiement_defaut, "
                    "validite_devis, mentions_legales, actif, date_creation, created_at, updated_at) "
                    "VALUES (:nom, :nom_commercial, :adresse, :code_postal, :ville, :telephone, :email, "
                    ":logo, :abonnement, :devise, :siret, :numero_tva, :code_ape, :site_web, "
                    ":prefixe_devis, :prefixe_facture, :prefixe_contrat, :tva_defaut, "
                    ":delai_paiement_defaut, :validite_devis, :mentions_legales, :actif, "
                    ":date_creation, NOW(), NOW())"
                ),
                ent_dict,
            )
            stats["by_table"]["entreprises"] = stats["by_table"].get("entreprises", 0) + 1

        await async_session.commit()
        logger.info("Entreprises migrées avec succès")

        # 3. Migrer les tables métier dans l'ordre (respect des FK)
        table_order = [
            "Utilisateur", "chantiers", "phases", "employes",
            "pointages", "heures_supplementaires", "equipes",
            "membres_equipe", "affectation_chantiers", "employes",
            "materiaux", "affectation_materiaux", "maintenances",
            "alertes_materiel", "fournisseurs", "articles",
            "mouvements_stock", "clients", "client_adresses",
            "devis", "lignes_devis", "contrats", "factures",
            "paiements", "depenses", "rapports_financiers",
            "alertes", "historique_postes", "affectation_ressources",
            "incidents", "sync_queue",
        ]

        for table_name in table_order:
            web_table = TABLE_MAPPING.get(table_name, table_name.lower())
            try:
                cursor.execute(f"SELECT * FROM `{table_name}`")
                rows = cursor.fetchall()

                if not rows:
                    logger.warning(f"Table {table_name} vide, ignorée")
                    continue

                columns = [desc[0] for desc in cursor.description]
                insert_count = 0

                for row in rows:
                    row_dict = map_columns(dict(row), COLUMN_MAPPING)

                    # Mappage rôle pour utilisateurs
                    if table_name == "Utilisateur" and "roleId" in row_dict:
                        role_code = row_dict.get("roleId")
                        if role_code:
                            # Récupérer le code rôle depuis la table Role
                            cursor.execute(
                                "SELECT code FROM Role WHERE id = ?", (role_code,)
                            )
                            role_row = cursor.fetchone()
                            if role_row:
                                web_code = map_role_code(role_row[0])
                                result = await async_session.execute(
                                    text("SELECT id FROM roles WHERE code = :code"),
                                    {"code": web_code},
                                )
                                role_match = result.fetchone()
                                if role_match:
                                    row_dict["role_id"] = role_match[0]

                    # Construire la requête INSERT
                    valid_cols = [c for c in row_dict if c not in ("id", "server_id", "isSynced")]
                    placeholders = ", ".join([f":{c}" for c in valid_cols])
                    cols_str = ", ".join(valid_cols)

                    if valid_cols:
                        await async_session.execute(
                            text(
                                f"INSERT INTO {web_table} ({cols_str}) VALUES ({placeholders})"
                            ),
                            row_dict,
                        )
                        insert_count += 1

                await async_session.commit()
                stats["by_table"][web_table] = insert_count
                stats["total_records"] += insert_count
                stats["tables_processed"] += 1
                logger.info(f"Table {table_name} → {web_table}: {insert_count} enregistrements")

            except Exception as e:
                stats["errors"].append(f"{table_name}: {str(e)}")
                await async_session.rollback()
                logger.error(f"Erreur migration {table_name}: {e}")

    except Exception as e:
        logger.error(f"Erreur fatale: {e}")
        await async_session.rollback()
        stats["errors"].append(str(e))
    finally:
        sqlite_conn.close()
        await async_session.close()
        await engine.dispose()

    return stats


def main():
    parser = argparse.ArgumentParser(description="Migration SQLite → MySQL")
    parser.add_argument("--sqlite", required=True, help="Path to Desktop SQLite file")
    parser.add_argument(
        "--target",
        required=True,
        help="MySQL connection URL (mysql+aiomysql://user:pass@host:port/db)",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    stats = asyncio.run(run_migration(args.sqlite, args.target))

    print("=" * 60)
    print("MIGRATION TERMINÉE")
    print("=" * 60)
    print(f"Tables traitées: {stats['tables_processed']}")
    print(f"Total enregistrements: {stats['total_records']}")
    print(f"Erreurs: {len(stats['errors'])}")
    for table, count in stats["by_table"].items():
        print(f"  - {table}: {count}")
    if stats["errors"]:
        print("\nErreurs:")
        for err in stats["errors"]:
            print(f"  - {err}")


if __name__ == "__main__":
    main()
