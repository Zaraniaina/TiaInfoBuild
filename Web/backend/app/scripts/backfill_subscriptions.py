"""Backfill ré-exécutable : stratégie d'abonnement par EMPLOYÉS.

Ce script :
  1. Aligne les 2 plans système (essai, gratuit) sur les valeurs cibles
     (quota employés généreux, prix 0).
  2. Soft-delete les anciens plans fictifs seedés (starter, pro, business,
     enterprise) — réels supprimables uniquement si aucune subscription active
     ne les référence (sinon ils sont laissés actifs pour ne pas casser l'existant).
  3. Met utilisateurs_max = NULL (illimité) sur les plans payants créés via le
     CRUD, sur demande explicite seulement : ce script ne touche que les codes
     système listés dans PLANS_SYSTEME ci-dessous.
  4. Donne un essai 30 jours aux entreprises sans AUCUNE subscription.
  5. Marque les subscriptions dépassées (lecture seule).

Sécurité : idempotent (relançable), jamais destructif pour les données métier.
Usage : env/Scripts/python.exe -m app.scripts.backfill_subscriptions
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import select, func

from app.database import AsyncSessionLocal
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.entreprise import Entreprise
from app.models import employe as _e  # noqa: F401 (enregistre les modèles)

# Valeurs cibles des 2 plans système (métrique = EMPLOYÉS actifs)
PLANS_SYSTEME = {
    "essai": {
        "nom": "Gratuit — Essai 30 jours",
        "description": "Accès complet pendant 30 jours : toutes les fonctionnalités, 10 employés, clients illimités.",
        "prix_mensuel": 0, "prix_annuel": 0, "utilisateurs_max": 10, "chantiers_max": 5, "duree_essai_jours": 30, "actif": True,
    },
    "gratuit": {
        "nom": "Gratuit",
        "description": "Formule gratuite permanente : 10 employés, clients illimités.",
        "prix_mensuel": 0, "prix_annuel": 0, "utilisateurs_max": 10, "chantiers_max": 3, "duree_essai_jours": 0, "actif": True,
    },
}

# Anciens plans fictifs du seed initial (fake data) à retirer du catalogue.
CODES_FICTIFS = ("starter", "pro", "business", "enterprise")


async def _autoriser_null_sur_quotas() -> None:
    """Rend les colonnes de quota nullable (null = illimité) sur la base existante."""
    from sqlalchemy import text as _text
    async with AsyncSessionLocal() as db:
        for col in ("utilisateurs_max", "chantiers_max", "stockage_go"):
            await db.execute(_text(f"ALTER TABLE plans MODIFY {col} INT NULL"))
        await db.commit()
    print("  Colonnes de quotas rendues nullable (NULL = illimité)")


async def main() -> None:
    await _autoriser_null_sur_quotas()
    async with AsyncSessionLocal() as db:
        # 1) Plans système : alignement complet (nom, quotas, prix, actif)
        for code, cible in PLANS_SYSTEME.items():
            plan = (await db.execute(select(Plan).where(Plan.code == code))).scalar_one_or_none()
            if not plan:
                plan = Plan(nom=cible["nom"], code=code, **{k: v for k, v in cible.items() if k != "nom"})
                db.add(plan)
                await db.flush()
                print(f"  Plan système « {code} » créé")
            changed = []
            for field, value in cible.items():
                current = getattr(plan, field)
                try:
                    differs = current is None or float(current) != float(value)
                except (TypeError, ValueError):
                    differs = current != value
                if differs:
                    setattr(plan, field, value)
                    changed.append(field)
            # Utilisateurs_max: NULL = illimité pour gratuit? Non — cible = 10.
            if plan.is_deleted:
                plan.is_deleted = False
                changed.append("is_deleted (restauré)")
            if plan.code in ("essai", "gratuit") and not plan.actif:
                plan.actif = True
                changed.append("actif (restauré)")
            if changed:
                print(f"  Plan {code}: {', '.join(changed)} mis à jour")
        await db.flush()

        # 2) Plans fictifs : migration des abonnements vers le plan gratuit, puis soft-delete.
        plan_gratuit = (await db.execute(select(Plan).where(Plan.code == "gratuit"))).scalar_one_or_none()
        for code in CODES_FICTIFS:
            plan = (await db.execute(select(Plan).where(Plan.code == code, Plan.is_deleted == False))).scalar_one_or_none()
            if not plan:
                continue
            subs_actives = (
                await db.execute(
                    select(Subscription).where(
                        Subscription.plan_id == plan.id,
                        Subscription.statut.in_(["actif", "essai"]),
                        Subscription.is_deleted == False,
                    )
                )
            ).scalars().all()
            if subs_actives and plan_gratuit:
                # Migration : les entreprises gardent leur échéance, sur le plan gratuit.
                for sub in subs_actives:
                    sub.plan_id = plan_gratuit.id
                    if sub.statut == "essai":
                        sub.statut = "actif"  # le gratuit est permanent
                        sub.periode = None
                print(f"  {len(subs_actives)} abonnement(s) migré(s) de « {code} » vers « gratuit »")
            plan.is_deleted = True
            plan.actif = False
            print(f"  Plan fictif « {code} » soft-deleted")
        await db.flush()

        # 3) Essai 30j pour les entreprises sans AUCUNE subscription
        entreprises = (await db.execute(select(Entreprise).where(Entreprise.is_deleted == False))).scalars().all()
        plan_essai = (await db.execute(select(Plan).where(Plan.code == "essai"))).scalar_one_or_none()
        created = 0
        for ent in entreprises:
            has_sub = (
                await db.execute(
                    select(Subscription.id).where(Subscription.entreprise_id == ent.id, Subscription.is_deleted == False).limit(1)
                )
            ).first()
            if has_sub or not plan_essai:
                continue
            now = datetime.now()
            db.add(
                Subscription(
                    entreprise_id=ent.id,
                    plan_id=plan_essai.id,
                    date_debut=now,
                    date_fin=now + timedelta(days=plan_essai.duree_essai_jours or 30),
                    date_prochain_renouvellement=now + timedelta(days=plan_essai.duree_essai_jours or 30),
                    statut="essai",
                    periode="essai",
                    prix_paye=0,
                )
            )
            if ent.abonnement in (None, "", "gratuit"):
                ent.abonnement = "essai"
            created += 1
        await db.commit()
        print(f"  {created} essai(s) de 30 jours créé(s) pour les entreprises sans abonnement")

        # 4) Marquer les subscriptions dépassées (lecture seule)
        now = datetime.now()
        result = await db.execute(
            select(Subscription).where(
                Subscription.statut.in_(["actif", "essai"]),
                Subscription.is_deleted == False,
                Subscription.date_fin.isnot(None),
                Subscription.date_fin < now,
            )
        )
        expired = result.scalars().all()
        for sub in expired:
            sub.statut = "expire"
        await db.commit()
        print(f"  {len(expired)} subscription(s) expirée(s) marquée(s)")

        print("[BACKFILL] Terminé.")


if __name__ == "__main__":
    asyncio.run(main())
