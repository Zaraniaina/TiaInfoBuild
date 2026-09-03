import asyncio
from sqlalchemy import text, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.config import settings

async def check_db():
    engine = create_async_engine(settings.database_url)
    
    async with engine.connect() as conn:
        result = await conn.execute(text('SHOW TABLES LIKE "alembic_version"'))
        tables = result.fetchall()
        print('alembic_version table exists:', len(tables) > 0)
        
        if tables:
            result = await conn.execute(text('SELECT version_num FROM alembic_version'))
            versions = result.fetchall()
            print('Current alembic version:', versions[0][0] if versions else 'EMPTY or no rows')
        
        result = await conn.execute(text('SHOW TABLES LIKE "avenants"'))
        tables = result.fetchall()
        print('avenants table exists:', len(tables) > 0)
        
        result = await conn.execute(text('SHOW TABLES'))
        all_tables = [row[0] for row in result.fetchall()]
        print('\nAll tables in database:', len(all_tables))
        print(all_tables)
    
    await engine.dispose()

asyncio.run(check_db())
