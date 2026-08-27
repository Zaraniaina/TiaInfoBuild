# je viens de teste l'app web:
code erreur :"2026-08-27 08:34:44,293 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:63361 - "POST /api/auth/refresh HTTP/1.1" 500 Internal Server Error
ERROR:    Exception in ASGI application
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
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\app\routers\auth.py", line 119, in refresh_token
    token_obj = result.scalar_one_or_none()
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 1541, in scalar_one_or_none
    return self._only_one_row(
           ~~~~~~~~~~~~~~~~~~^
        raise_for_second_row=True, raise_for_none=False, scalar=True
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
  File "D:\Tia_info_projet\projet 2\TiaInfoBuild\web\backend\env\Lib\site-packages\sqlalchemy\engine\result.py", line 852, in _only_one_row
    raise exc.MultipleResultsFound(
    ...<4 lines>...
    )
sqlalchemy.exc.MultipleResultsFound: Multiple rows were found when one or none was required"