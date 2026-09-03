import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def fix():
    from app.config import settings
    engine = create_async_engine(settings.database_url)

    async with engine.connect() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        await conn.execute(text(
            "CREATE TABLE alembic_version ("
            "version_num VARCHAR(255) NOT NULL, "
            "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)"
            ")"
        ))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('012_add_avenants')"))
        await conn.commit()

        result = await conn.execute(text("SELECT version_num FROM alembic_version"))
        for r in result.fetchall():
            print("Version:", repr(r[0]))
        print("OK - alembic_version table fixed")

    await engine.dispose()

asyncio.run(fix())
