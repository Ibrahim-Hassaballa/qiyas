from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from Backend.Source.Core.Database import get_db
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import AuthenticationError, AuthorizationError
from Backend.Source.Services.AuthService import auth_service
from Backend.Source.Models.User import User
from Backend.Source.Utils.CSRF import generate_csrf_token, verify_csrf
from Backend.Source.Middleware.RateLimiting import limiter
from jose import JWTError, jwt
from Backend.Source.Core.Security import SECRET_KEY, ALGORITHM

router = APIRouter()


class UserCreate(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    """Response for login/register (no longer returns token in body)"""
    message: str
    csrf_token: str



# Updated dependency to get user from cookie
async def get_current_user_from_cookie(
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to extract current user from httpOnly cookie

    Args:
        access_token: JWT from cookie
        db: Database session

    Returns:
        User object

    Raises:
        AuthenticationError: If token invalid or missing
    """
    if not access_token:
        logger.warning("No access token in cookie")
        raise AuthenticationError("Not authenticated")

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise AuthenticationError("Invalid token payload")
    except JWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        raise AuthenticationError("Invalid or expired token")

    user = auth_service.get_user_by_username(db, username=username)
    if user is None:
        raise AuthenticationError("User not found")

    return user


@router.post("/token", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint - sets JWT in httpOnly cookie
    """
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        raise AuthenticationError("Incorrect username or password")

    # Create token
    token_data = auth_service.create_token_for_user(user)
    access_token = token_data["access_token"]

    # Generate CSRF token
    csrf_token = generate_csrf_token()

    # Set JWT in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,  # Prevents JavaScript access
        secure=settings.COOKIE_SECURE,  # True in production (HTTPS only)
        samesite=settings.COOKIE_SAMESITE,  # CSRF protection
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # seconds
        domain=settings.COOKIE_DOMAIN
    )

    logger.info(f"User logged in successfully: {user.username}", extra={"user_id": user.id})

    return {
        "message": "Login successful",
        "csrf_token": csrf_token
    }


@router.post("/register", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def register_user(
    request: Request,
    response: Response,
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register new user - sets JWT in httpOnly cookie
    """
    # Check if user exists
    existing_user = auth_service.get_user_by_username(db, user_data.username)
    if existing_user:
        logger.warning(f"Registration attempted for existing username: {user_data.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    new_user = auth_service.create_user(db, user_data.username, user_data.password)

    # Create token
    token_data = auth_service.create_token_for_user(new_user)
    access_token = token_data["access_token"]

    # Generate CSRF token
    csrf_token = generate_csrf_token()

    # Set JWT in httpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        domain=settings.COOKIE_DOMAIN
    )

    logger.info(f"New user registered: {new_user.username}", extra={"user_id": new_user.id})

    return {
        "message": "Registration successful",
        "csrf_token": csrf_token
    }


@router.post("/logout")
async def logout(response: Response):
    """
    Logout endpoint - clears auth cookie
    """
    response.delete_cookie(
        key="access_token",
        domain=settings.COOKIE_DOMAIN
    )

    logger.info("User logged out")

    return {"message": "Logout successful"}


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user_from_cookie)):
    """Get current authenticated user info"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "created_at": current_user.created_at.isoformat()
    }


@router.get("/csrf")
@limiter.limit("10/minute")  # Rate limit to prevent token flooding
async def get_csrf_token(request: Request):
    """Get a new CSRF token for authenticated requests"""
    csrf_token = generate_csrf_token()
    return {"csrf_token": csrf_token}




# Export for use in other routes
get_current_user = get_current_user_from_cookie

