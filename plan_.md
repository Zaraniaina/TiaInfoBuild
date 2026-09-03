# j'ai voulais recreer mon bd et relance mon projet backend:
 > code erreur "(env) PS D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend> alembic upgrade head
INFO  [alembic.runtime.migration] Context impl MySQLImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial_schema, initial schema
INFO  [alembic.runtime.migration] Running upgrade 001_initial_schema -> 002_chantiers_schema, second migration: add chantiers, phases, incidents
INFO  [alembic.runtime.migration] Running upgrade 002_chantiers_schema -> 003_roles_and_historique_poste, third migration: add roles seed, historique_poste, employes
INFO  [alembic.runtime.migration] Running upgrade 003_roles_and_historique_poste -> 004_remaining_modules, fourth migration: remaining tables (RH, materiels, stocks, commercial)
INFO  [alembic.runtime.migration] Running upgrade 004_remaining_modules -> 005_finance_alertes_sync, fifth migration: finance, alertes, sync_queue tables + paiements table
INFO  [alembic.runtime.migration] Running upgrade 005_finance_alertes_sync -> 006_add_missing_columns, sixth migration: add missing is_deleted, created_at, updated_at columns
INFO  [alembic.runtime.migration] Running upgrade 006_add_missing_columns -> 007_convert_ids_to_bigint, convert ids and fks to bigint
INFO  [alembic.runtime.migration] Running upgrade 007_convert_ids_to_bigint -> 008_add_code_qr_badge, eighth migration: add code_qr_badge column to employes table
INFO  [alembic.runtime.migration] Running upgrade 008_add_code_qr_badge -> 009_add_pointage_columns, ninth migration: add missing columns to pointages table
INFO  [alembic.runtime.migration] Running upgrade 009_add_pointage_columns -> 010_add_subscriptions, tenth migration: add subscription plans and subscription tracking
INFO  [alembic.runtime.migration] Running upgrade 010_add_subscriptions -> 011_add_ligne_categories_and_facture_totals, eleventh migration: add ligne categories and facture calculated fields
INFO  [alembic.runtime.migration] Running upgrade 011_add_ligne_categories_and_facture_totals -> 012_add_avenants, twelfth migration: add avenants table
ERROR [alembic.util.messaging] Online migration expected to match one row when updating '011_add_ligne_categories_and_facture_totals' to '012_add_avenants' in 'alembic_version'; 0 found
FAILED: Online migration expected to match one row when updating '011_add_ligne_categories_and_facture_totals' to '012_add_avenants' in 'alembic_version'; 0 found
(env) PS D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend> alembic stamp 011_add_ligne_categories_and_facture_totals
INFO  [alembic.runtime.migration] Context impl MySQLImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
(env) PS D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend> alembic upgrade head
INFO  [alembic.runtime.migration] Context impl MySQLImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 011_add_ligne_categories_and_facture_totals -> 012_add_avenants, twelfth migration: add avenants table
Traceback (most recent call last):
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1969, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 230, in execute
    self._adapt_connection._handle_exception(error)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 368, in _handle_exception
    raise error.with_traceback(exc_info[2])
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 228, in execute
    return self.await_(self._execute_async(operation, parameters))
           ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 251, in _execute_async
    result = await self._cursor.execute(operation, parameters)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\cursors.py", line 239, in execute
    await self._query(query)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\cursors.py", line 457, in _query
    await conn.query(q)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 469, in query
    await self._read_query_result(unbuffered=unbuffered)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 683, in _read_query_result
    await result.read()
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 1164, in read
    first_packet = await self.connection._read_packet()
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 652, in _read_packet
    packet.raise_for_error()
    ~~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\pymysql\protocol.py", line 219, in raise_for_error
    err.raise_mysql_exception(self._data)
    ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\pymysql\err.py", line 154, in raise_mysql_exception
    raise errorclass(errno, errval, sqlstate=sqlstate)
pymysql.err.OperationalError: (1050, "Table 'avenants' already exists")

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "<frozen runpy>", line 203, in _run_module_as_main
  File "<frozen runpy>", line 88, in _run_code
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Scripts\alembic.exe\__main__.py", line 5, in <module>
    sys.exit(main())
             ~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\config.py", line 1039, in main
    CommandLine(prog=prog).main(argv=argv)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\config.py", line 1029, in main
    self.run_cmd(cfg, options)
    ~~~~~~~~~~~~^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\config.py", line 963, in run_cmd
    fn(
    ~~^
        config,
        ^^^^^^^
        *[getattr(options, k, None) for k in positional],
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        **{k: getattr(options, k, None) for k in kwarg},
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\command.py", line 487, in upgrade
    script.run_env()
    ~~~~~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\script\base.py", line 550, in run_env
    util.load_python_file(self.dir, "env.py")
    ~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\util\pyfiles.py", line 114, in load_python_file
    module = load_module_py(module_id, path)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\util\pyfiles.py", line 132, in load_module_py
    spec.loader.exec_module(module)  # type: ignore
    ~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^
  File "<frozen importlib._bootstrap_external>", line 759, in exec_module
  File "<frozen importlib._bootstrap>", line 491, in _call_with_frames_removed
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\alembic\env.py", line 68, in <module>
    run_migrations_online()
    ~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\alembic\env.py", line 62, in run_migrations_online
    asyncio.run(run_async_migrations())
    ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^
  File "C:\Users\Zaraniaina\AppData\Local\Programs\Python\Python314\Lib\asyncio\runners.py", line 205, in run
    return runner.run(main)
           ~~~~~~~~~~^^^^^^
  File "C:\Users\Zaraniaina\AppData\Local\Programs\Python\Python314\Lib\asyncio\runners.py", line 128, in run
    return self._loop.run_until_complete(task)
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^
  File "C:\Users\Zaraniaina\AppData\Local\Programs\Python\Python314\Lib\asyncio\base_events.py", line 719, in run_until_complete
    return future.result()
           ~~~~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\alembic\env.py", line 55, in run_async_migrations
    await connection.run_sync(do_run_migrations)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\ext\asyncio\engine.py", line 888, in run_sync
    return await greenlet_spawn(
           ^^^^^^^^^^^^^^^^^^^^^
        fn, self._proxied, *arg, _require_await=False, **kw
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 203, in greenlet_spawn
    result = context.switch(value)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\alembic\env.py", line 43, in do_run_migrations
    context.run_migrations()
    ~~~~~~~~~~~~~~~~~~~~~~^^
  File "<string>", line 8, in run_migrations
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\runtime\environment.py", line 967, in run_migrations
    self.get_context().run_migrations(**kw)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\runtime\migration.py", line 621, in run_migrations
    step.migration_fn(**kw)
    ~~~~~~~~~~~~~~~~~^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\Web\backend\alembic\versions\012_add_avenants.py", line 20, in upgrade
    op.create_table(
    ~~~~~~~~~~~~~~~^
        "avenants",
        ^^^^^^^^^^^
    ...<12 lines>...
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "<string>", line 8, in create_table
  File "<string>", line 3, in create_table
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\operations\ops.py", line 1323, in create_table
    return operations.invoke(op)
           ~~~~~~~~~~~~~~~~~^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\operations\base.py", line 448, in invoke
    return fn(self, operation)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\operations\toimpl.py", line 140, in create_table
    operations.impl.create_table(table, **kw)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\ddl\impl.py", line 434, in create_table
    self._exec(schema.CreateTable(table, **kw))
    ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\alembic\ddl\impl.py", line 252, in _exec
    return conn.execute(construct, params)
           ~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1421, in execute
    return meth(
        self,
        distilled_parameters,
        execution_options or NO_OPTIONS,
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\sql\ddl.py", line 188, in _execute_on_connection
    return connection._execute_ddl(
           ~~~~~~~~~~~~~~~~~~~~~~~^
        self, distilled_params, execution_options
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1532, in _execute_ddl
    ret = self._execute_context(
        dialect,
    ...<4 lines>...
        compiled,
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1848, in _execute_context
    return self._exec_single_context(
           ~~~~~~~~~~~~~~~~~~~~~~~~~^
        dialect, context, statement, parameters
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1988, in _exec_single_context
    self._handle_dbapi_exception(
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        e, str_statement, effective_parameters, cursor, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 2365, in _handle_dbapi_exception
    raise sqlalchemy_exception.with_traceback(exc_info[2]) from e
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1969, in _exec_single_context
    self.dialect.do_execute(
    ~~~~~~~~~~~~~~~~~~~~~~~^
        cursor, str_statement, effective_parameters, context
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\default.py", line 952, in do_execute
    cursor.execute(statement, parameters)
    ~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 230, in execute
    self._adapt_connection._handle_exception(error)
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 368, in _handle_exception
    raise error.with_traceback(exc_info[2])
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 228, in execute
    return self.await_(self._execute_async(operation, parameters))
           ~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 132, in await_only
    return current.parent.switch(awaitable)  # type: ignore[no-any-return,attr-defined] # noqa: E501
           ~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 196, in greenlet_spawn
    value = await result
            ^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\connectors\asyncio.py", line 251, in _execute_async
    result = await self._cursor.execute(operation, parameters)
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\cursors.py", line 239, in execute
    await self._query(query)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\cursors.py", line 457, in _query
    await conn.query(q)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 469, in query
    await self._read_query_result(unbuffered=unbuffered)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 683, in _read_query_result
    await result.read()
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 1164, in read
    first_packet = await self.connection._read_packet()
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\aiomysql\connection.py", line 652, in _read_packet
    packet.raise_for_error()
    ~~~~~~~~~~~~~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\pymysql\protocol.py", line 219, in raise_for_error
    err.raise_mysql_exception(self._data)
    ~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\pymysql\err.py", line 154, in raise_mysql_exception
    raise errorclass(errno, errval, sqlstate=sqlstate)
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1050, "Table 'avenants' already exists")
[SQL: 
CREATE TABLE avenants (
        id BIGINT NOT NULL AUTO_INCREMENT, 
        entreprise_id INTEGER NOT NULL, 
        contrat_id INTEGER NOT NULL, 
        numero VARCHAR(50) NOT NULL, 
        description TEXT, 
        impact_montant NUMERIC(12, 2) NOT NULL DEFAULT '0', 
        date_signature DATE, 
        statut VARCHAR(20) NOT NULL DEFAULT 'propose', 
        fichier_url VARCHAR(255), 
        notes TEXT, 
        is_deleted BOOL NOT NULL DEFAULT '0', 
        created_at DATETIME DEFAULT (now()), 
        updated_at DATETIME DEFAULT (now()), 
        PRIMARY KEY (id), 
        FOREIGN KEY(entreprise_id) REFERENCES entreprises (id) ON DELETE CASCADE, 
        FOREIGN KEY(contrat_id) REFERENCES contrats (id) ON DELETE CASCADE
)

]
(Background on this error at: https://sqlalche.me/e/20/e3q8)
(env) PS D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend> "