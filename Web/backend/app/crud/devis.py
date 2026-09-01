"""CRUD pour le modèle Devis."""
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.devis import Devis
from app.schemas.devis import DevisCreate, DevisUpdate
from app.crud.base import BaseCRUD
from app.models.ligne_devis import LigneDevis
from typing import List


class DevisCRUD(BaseCRUD[Devis]):
    def __init__(self) -> None:
        super().__init__(Devis)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Devis], int]:
        query = select(Devis).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Devis.id).where(Devis.entreprise_id == entreprise_id, Devis.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: dict) -> Devis:
        """Crée un Devis et ses LignesDevis associées (si fournies).

        Calcule les totaux des lignes si nécessaire et met à jour les montants du devis.
        """
        lignes: List[dict] | None = obj_in.pop("lignes", None)

        # Création du devis
        db_obj = Devis(**obj_in)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)

        total_ht = 0.0
        total_ttc = 0.0

        if lignes:
            for idx, l in enumerate(lignes):
                # Normaliser champs numériques
                quantite = float(l.get("quantite") or 0)
                prix_unitaire = float(l.get("prix_unitaire") or 0)
                remise = float(l.get("remise") or 0)
                taux_tva = float(l.get("taux_tva") or l.get("tva") or (db_obj.tva or 0))

                # Calculer total_ht si absent
                if not l.get("total_ht"):
                    total_ht_l = quantite * prix_unitaire * (1 - remise / 100)
                else:
                    total_ht_l = float(l.get("total_ht") or 0)

                # Calculer total_ttc si absent
                if not l.get("total_ttc"):
                    total_ttc_l = total_ht_l * (1 + taux_tva / 100)
                else:
                    total_ttc_l = float(l.get("total_ttc") or 0)

                total_ht += total_ht_l
                total_ttc += total_ttc_l

                ligne_obj = LigneDevis(
                    devis_id=db_obj.id,
                    type=l.get("type") or "article",
                    article_id=l.get("article_id"),
                    description=l.get("description") or "",
                    quantite=quantite,
                    unite=l.get("unite"),
                    prix_unitaire=prix_unitaire,
                    remise=remise,
                    taux_tva=taux_tva,
                    total_ht=total_ht_l,
                    total_ttc=total_ttc_l,
                    ordre=l.get("ordre") or idx,
                )
                db.add(ligne_obj)

            await db.flush()

        # Mettre à jour les totaux du devis
        db_obj.montant_ht = total_ht
        db_obj.montant_ttc = total_ttc
        await db.flush()
        await db.refresh(db_obj)

        return db_obj
