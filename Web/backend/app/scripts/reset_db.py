import asyncio
from sqlalchemy import text
from app.database import engine

async def reset():
    print("Resetting database tia_build_db...")
    async with engine.connect() as conn:
        await conn.execute(text("DROP DATABASE IF EXISTS tia_build_db;"))
        await conn.execute(text("CREATE DATABASE tia_build_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
    print("✅ Database tia_build_db recreated cleanly!")

if __name__ == "__main__":
    asyncio.run(reset())
