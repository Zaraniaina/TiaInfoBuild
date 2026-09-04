"""Debug du login."""
import asyncio
from sqlalchemy import text
from app.database import engine


async def check_users():
    async with engine.connect() as conn:
        print('--- COLONNES devis ---')
        r = await conn.execute(text("SHOW COLUMNS FROM devis"))
        for row in r:
            print(' ', row[0], row[1])
        print('--- COLONNES factures ---')
        r = await conn.execute(text("SHOW COLUMNS FROM factures"))
        for row in r:
            print(' ', row[0], row[1])
        print('--- COLONNES chantiers (situations) ---')
        r = await conn.execute(text("SHOW COLUMNS FROM chantiers"))
        for row in r:
            print(' ', row[0], row[1])


asyncio.run(check_users())