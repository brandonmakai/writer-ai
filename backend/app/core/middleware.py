"""Application-level HTTP middleware."""

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_MUTATION_METHODS = frozenset({"POST", "PUT", "PATCH"})


class EnforceContentTypeMiddleware(BaseHTTPMiddleware):
    """Reject mutation requests that don't declare Content-Type: application/json.

    Browsers cannot send application/json cross-origin without triggering a
    CORS preflight. Our CORS policy only allows our own origin, so any
    cross-site form submission or fetch() with a non-JSON content type is
    blocked here before it reaches a route handler.

    Returns 415 Unsupported Media Type for non-compliant requests.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method in _MUTATION_METHODS:
            content_type = request.headers.get("content-type", "")
            if not content_type.startswith("application/json"):
                return JSONResponse(
                    {"detail": "Content-Type must be application/json"},
                    status_code=415,
                )
        return await call_next(request)
