"""CRUD Congé : listes scope entreprise/employé, solde calculé, décision."""
from datetime import date, datetime
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import select, func

from app.crud.base import BaseCRUD
from app.models.conge import Conge


class CongeCRUD(BaseCRUD[Conge]):
    """CRUD pour les demandes de congés."""

    def __init__(self) -> None:
        super().__init__(Conge)

    async def list_for_entreprise(self, db, entreprise_id: int, *, statut: str | None = None,
                                  employe_id: int | None = None, page: int = 1, size: int = 25
                                  ) -> tuple[Sequence[Conge], int]:
        query = select(Conge).where(Conge.is_deleted == False, Conge.entreprise_id == entreprise_id)
        if statut:
            query = query.where(Conge.statut == statut)
        if employe_id:
            query = query.where(Conge.employe_id == employe_id)
        return await self._paginate_query(db, query, page, size)

    async def list_for_employe(self, db, employe_id: int, *, page: int = 1, size: int = 25):
        query = select(Conge).where(Conge.is_deleted == False, Conge.employe_id == employe_id)
        return await self._paginate_query(db, query, page, size)

    async def solde_restant(self, db, employe) -> float:
        """Solde calculé : solde annuel - jours de congés annuels validés de l'année courante."""
        annee = date.today().year
        total = (await db.execute(
            select(func.coalesce(func.sum(Conge.nb_jours), 0)).where(
                Conge.employe_id == employe.id,
                Conge.type == Conge.TYPE_ANNUEL,
                Conge.statut == Conge.STATUT_VALIDE,
                Conge.is_deleted == False,
                func.extract("year", Conge.date_debut) == annee,
            )
        )).scalar_one()
        return float(employe.solde_conges_annuel or 30) - float(total)

    async def decide(self, db, conge: Conge, *, statut: str, valide_par: int | None,
                     commentaire: str | None) -> Conge:
        """Valide ou refuse une demande. Garde anti double-validation (409)."""
        if conge.statut != Conge.STATUT_EN_ATTENTE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail=f"Ce congé a déjà été traité (statut: {conge.statut})")
        conge.statut = statut
        conge.valide_par = valide_par
        conge.date_validation = datetime.now()
        if statut == Conge.STATUT_REFUSE and commentaire:
            conge.commentaire_refus = commentaire
        await db.flush()
        await db.refresh(conge)
        return conge

    async def _paginate_query(self, db, query, page: int, size: int) -> tuple[Sequence[Conge], int]:
        total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
        result = await db.execute(
            query.order_by(Conge.created_at.desc(), Conge.id.desc()).offset((page - 1) * size).limit(size)
        )
        return result.scalars().all(), total
