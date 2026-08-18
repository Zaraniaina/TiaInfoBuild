"""CRUD pour le modèle Article."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.article import Article
from app.schemas.article import ArticleCreate, ArticleUpdate
from app.crud.base import BaseCRUD


class ArticleCRUD(BaseCRUD[Article]):
    def __init__(self) -> None:
        super().__init__(Article)

    async def get_by_entreprise(self, db: AsyncSession, entreprise_id: int, skip: int = 0, limit: int = 100) -> tuple[list[Article], int]:
        query = select(Article).where(Article.entreprise_id == entreprise_id, Article.is_deleted == False)
        result = await db.execute(query.offset(skip).limit(limit))
        count_query = select(Article.id).where(Article.entreprise_id == entreprise_id, Article.is_deleted == False)
        count_result = await db.execute(count_query)
        return list(result.scalars().all()), len(count_result.scalars().all())

    async def get_by_reference(self, db: AsyncSession, reference: str) -> Article | None:
        result = await db.execute(select(Article).where(Article.reference == reference))
        return result.scalar_one_or_none()

    async def get_en_alerte(self, db: AsyncSession, entreprise_id: int) -> list[Article]:
        result = await db.execute(
            select(Article).where(Article.entreprise_id == entreprise_id, Article.stock_actuel <= Article.seuil_alerte, Article.is_deleted == False)
        )
        return list(result.scalars().all())
