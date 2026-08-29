INFO:     127.0.0.1:52282 - "POST /api/auth/register-entreprise HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
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
pymysql.err.OperationalError: (1054, "Unknown column 'pointages.methode_pointage' in 'field list'")

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\uvicorn\protocols\http\httptools_impl.py", line 401, in run_asgi
    result = await app(  # type: ignore[func-returns-value]
             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        self.scope, self.receive, self.send
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\uvicorn\middleware\proxy_headers.py", line 70, in __call__
    return await self.app(scope, receive, send)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\applications.py", line 1163, in __call__
    await super().__call__(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\applications.py", line 96, in __call__
    await self.middleware_stack(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\errors.py", line 186, in __call__
    raise exc
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\errors.py", line 164, in __call__
    await self.app(scope, receive, _send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\cors.py", line 96, in __call__
    await self.simple_response(scope, receive, send, request_headers=headers)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\cors.py", line 154, in simple_response
    await self.app(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 193, in __call__
    response = await self.dispatch_func(request, call_next)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\app\middleware.py", line 44, in dispatch
    return await call_next(request)
           ^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 168, in call_next
    raise app_exc from app_exc.__cause__ or app_exc.__context__
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 144, in coro
    await self.app(scope, receive_or_disconnect, send_no_error)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 193, in __call__
    response = await self.dispatch_func(request, call_next)
               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\app\middleware.py", line 16, in dispatch
    response = await call_next(request)
               ^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 168, in call_next
    raise app_exc from app_exc.__cause__ or app_exc.__context__
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\base.py", line 144, in coro
    await self.app(scope, receive_or_disconnect, send_no_error)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\gzip.py", line 78, in __call__
    await responder(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\gzip.py", line 103, in __call__
    await self.app(scope, receive, self.send_with_compression)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\middleware\exceptions.py", line 63, in __call__
    await wrap_app_handling_exceptions(self.app, conn)(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\middleware\asyncexitstack.py", line 18, in __call__
    await self.app(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\routing.py", line 670, in __call__
    await self.middleware_stack(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 2734, in app
    await route.handle(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 1780, in handle
    await self.original_router.handle(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 2789, in handle
    await included_router._handle_selected(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 1800, in _handle_selected
    await original_route.handle(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 1279, in handle
    await app(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 158, in app
    await wrap_app_handling_exceptions(app, request)(scope, receive, send)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\_exception_handler.py", line 53, in wrapped_app
    raise exc
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\starlette\_exception_handler.py", line 42, in wrapped_app
    await app(scope, receive, sender)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 144, in app
    response = await f(request)
               ^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 706, in app
    raw_response = await run_endpoint_function(
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    ...<3 lines>...
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\fastapi\routing.py", line 352, in run_endpoint_function
    return await dependant.call(**values)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\app\routers\auth.py", line 217, in register_entreprise
    await db.refresh(entreprise)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\ext\asyncio\session.py", line 328, in refresh
    await greenlet_spawn(
    ...<4 lines>...
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\util\_concurrency_py3k.py", line 203, in greenlet_spawn
    result = context.switch(value)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\session.py", line 3176, in refresh
    loading.load_on_ident(
    ~~~~~~~~~~~~~~~~~~~~~^
        self,
        ^^^^^
    ...<10 lines>...
        is_user_refresh=True,
        ^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\loading.py", line 510, in load_on_ident
    return load_on_pk_identity(
        session,
    ...<11 lines>...
        is_user_refresh=is_user_refresh,
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\loading.py", line 706, in load_on_pk_identity
    return result.one()
           ~~~~~~~~~~^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 1867, in one
    return self._only_one_row(
           ~~~~~~~~~~~~~~~~~~^
        raise_for_second_row=True, raise_for_none=True, scalar=False
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 796, in _only_one_row
    row: Optional[_InterimRowType[Any]] = onerow(hard_close=True)
                                          ~~~~~~^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 1730, in _fetchone_impl
    return self._real_result._fetchone_impl(hard_close=hard_close)
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 2326, in _fetchone_impl
    row = next(self.iterator, _NO_ROW)
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\loading.py", line 247, in chunks
    post_load.invoke(context, path)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\loading.py", line 1564, in invoke
    loader(
    ~~~~~~^
        effective_context, path, states, self.load_keys, *arg, **kw
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\strategies.py", line 1447, in _load_for_path
    value = lazyloader._load_for_state(
        state,
    ...<3 lines>...
        execution_options=execution_options,
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\strategies.py", line 978, in _load_for_state
    return self._emit_lazyload(
           ~~~~~~~~~~~~~~~~~~~^
        session,
        ^^^^^^^^
    ...<7 lines>...
        execution_options,
        ^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\strategies.py", line 1141, in _emit_lazyload
    result = session.execute(
        stmt, params, execution_options=execution_options
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\session.py", line 2373, in execute
    return self._execute_internal(
           ~~~~~~~~~~~~~~~~~~~~~~^
        statement,
        ^^^^^^^^^^
    ...<4 lines>...
        _add_event=_add_event,
        ^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\session.py", line 2271, in _execute_internal
    result: Result[Any] = compile_state_cls.orm_execute_statement(
                          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self,
        ^^^^^
    ...<4 lines>...
        conn,
        ^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\orm\context.py", line 306, in orm_execute_statement
    result = conn.execute(
        statement, params or {}, execution_options=execution_options
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1421, in execute
    return meth(
        self,
        distilled_parameters,
        execution_options or NO_OPTIONS,
    )
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\sql\elements.py", line 526, in _execute_on_connection
    return connection._execute_clauseelement(
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
        self, distilled_params, execution_options
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\base.py", line 1643, in _execute_clauseelement
    ret = self._execute_context(
        dialect,
    ...<8 lines>...
        cache_hit=cache_hit,
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
sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (1054, "Unknown column 'pointages.methode_pointage' in 'field list'")
[SQL: SELECT pointages.id AS pointages_id, pointages.entreprise_id AS pointages_entreprise_id, pointages.employe_id AS pointages_employe_id, pointages.chantier_id AS pointages_chantier_id, pointages.date_jour AS pointages_date_jour, pointages.heure_debut AS pointages_heure_debut, pointages.heure_fin AS pointages_heure_fin, pointages.heures_total AS pointages_heures_total, pointages.type AS pointages_type, pointages.methode_pointage AS pointages_methode_pointage, pointages.scanne_par_id AS pointages_scanne_par_id, pointages.latitude AS pointages_latitude, pointages.longitude AS pointages_longitude, pointages.statut_validation AS pointages_statut_validation, pointages.notes AS pointages_notes, pointages.is_deleted AS pointages_is_deleted, pointages.created_at AS pointages_created_at, pointages.updated_at AS pointages_updated_at
FROM pointages
WHERE %s = pointages.entreprise_id]
[parameters: (2,)]
(Background on this error at: https://sqlalche.me/e/20/e3q8)