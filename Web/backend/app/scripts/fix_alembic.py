from app.database import engine
from sqlalchemy import text
import asyncio

async def fix_version():
    async with engine.begin() as conn:
        await conn.execute(text('DELETE FROM alembic_version'))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('011_add_ligne_categories_and_facture_totals')"))
        print('Fixed alembic_version')

asyncio.run(fix_version())
