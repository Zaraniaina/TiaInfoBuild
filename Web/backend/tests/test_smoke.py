"""Test de fumée : vérifie que l'infra de test (SQLite en mémoire + overrides) fonctionne."""


async def test_smoke_app_repond(db_session, client_factory):
    ent = None
    async with await client_factory("super_admin", entreprise_id=ent) as client:
        r = await client.get("/api/rh/employes")
        # Auth OK (pas 401) : le payload simulé est accepté, la route répond.
        assert r.status_code in (200, 403), r.text


async def test_smoke_db_session(db_session):
    from sqlalchemy import text

    result = await db_session.execute(text("SELECT 1"))
    assert result.scalar_one() == 1
