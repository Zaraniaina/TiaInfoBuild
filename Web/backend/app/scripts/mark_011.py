from app.database import engine
from sqlalchemy import text
import asyncio

async def mark_011():
    async with engine.begin() as conn:
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('011_add_ligne_categories_and_facture_totals') ON DUPLICATE KEY UPDATE version_num = version_num"))
        print('Marked 011 as applied')

asyncio.run(mark_011())
