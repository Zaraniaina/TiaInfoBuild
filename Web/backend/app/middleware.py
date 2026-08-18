"""Middleware: logging, rate limiting placeholder, multi-tenant injection."""
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
import time
import logging

from app.config import settings

logger = logging.getLogger("tia")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        start = time.time()
        response = await call_next(request)
        duration = (time.time() - start) * 1000
        logger.info(
            "%s %s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            request.client.host if request.client else "?",
            duration,
        )
        return response


class MultiTenantMiddleware(BaseHTTPMiddleware):
    """Injecte l'entreprise_id dans request.state depuis le token JWT."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                from app.security import decode_token
                payload = decode_token(token)
                request.state.entreprise_id = payload.get("entreprise_id")
                request.state.user_id = payload.get("sub")
                request.state.role_code = payload.get("role_code")
            except Exception:
                pass
        return await call_next(request)
