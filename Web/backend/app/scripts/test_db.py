from app.database import engine
from sqlalchemy import text
import asyncio

async def test():
    async with engine.begin() as conn:
        await conn.execute(text('SELECT 1'))
        print('DB OK')

asyncio.run(test())
