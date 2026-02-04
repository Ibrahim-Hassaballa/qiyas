import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Request, HTTPException, status
from Backend.Source.Core.Logging import logger

# In-memory store for CSRF tokens (use Redis in production)
csrf_tokens: dict[str, datetime] = {}

CSRF_TOKEN_EXPIRY = timedelta(hours=1)


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token"""
    token = secrets.token_urlsafe(32)
    csrf_tokens[token] = datetime.now(timezone.utc) + CSRF_TOKEN_EXPIRY
    return token


def validate_csrf_token(token: Optional[str]) -> bool:
    """
    Validate CSRF token

    Args:
        token: CSRF token from request

    Returns:
        True if valid, False otherwise
    """
    if not token:
        return False

    # Check if token exists and not expired
    expiry = csrf_tokens.get(token)
    if not expiry:
        return False

    if datetime.now(timezone.utc) > expiry:
        # Token expired, remove it
        del csrf_tokens[token]
        return False

    return True


def cleanup_expired_tokens():
    """Remove expired CSRF tokens from store"""
    now = datetime.now(timezone.utc)
    expired = [token for token, expiry in csrf_tokens.items() if now > expiry]
    for token in expired:
        del csrf_tokens[token]


async def verify_csrf(request: Request) -> None:
    """
    Dependency to verify CSRF token in requests

    Raises:
        HTTPException: If CSRF token invalid or missing
    """
    # Skip CSRF for GET, HEAD, OPTIONS
    if request.method in ["GET", "HEAD", "OPTIONS"]:
        return

    # Get CSRF token from header
    csrf_token = request.headers.get("X-CSRF-Token")

    if not validate_csrf_token(csrf_token):
        logger.warning(f"Invalid CSRF token from {request.client.host if request.client else 'unknown'}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing CSRF token"
        )

    # Token is valid
    logger.debug("CSRF token validated successfully")
