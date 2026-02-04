from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from typing import Optional


def get_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting
    Uses IP + user_id if authenticated, otherwise just IP
    """
    # Try to get user from request state (set by auth middleware)
    user_id = getattr(request.state, 'user_id', None)
    ip_address = get_remote_address(request)

    if user_id:
        identifier = f"{ip_address}:{user_id}"
    else:
        identifier = ip_address

    return identifier


# Create limiter instance
limiter = Limiter(
    key_func=get_identifier,
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri="memory://",  # Use redis:// in production
    strategy="fixed-window"
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler for rate limit exceeded"""
    identifier = get_identifier(request)
    logger.warning(
        f"Rate limit exceeded for {identifier} on {request.url.path}",
        extra={"ip_address": get_remote_address(request)}
    )

    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "Too many requests. Please try again later.",
            "retry_after": str(exc.detail)
        },
        headers={"Retry-After": str(exc.detail)}
    )
