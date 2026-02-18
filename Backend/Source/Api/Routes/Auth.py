from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Cookie
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from Backend.Source.Core.Database import get_db
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import AuthenticationError, AuthorizationError, AccountInactiveError
from Backend.Source.Services.AuthService import auth_service
from Backend.Source.Models.User import User
from Backend.Source.Models.Tenant import Tenant
from Backend.Source.Utils.CSRF import generate_csrf_token, verify_csrf
from Backend.Source.Middleware.RateLimiting import limiter
from jose import JWTError, jwt
from Backend.Source.Core.Security import SECRET_KEY, ALGORITHM

router = APIRouter()


# --- Pydantic Schemas ---

class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    tenant_id: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    """Response for login/register (token set in httpOnly cookie)"""
    message: str
    csrf_token: str


class RegisterResponse(BaseModel):
    """Response for registration (no auto-login, pending activation)"""
    message: str
    pending_activation: bool = True


class UserInfoResponse(BaseModel):
    id: str
    email: str
    username: str
    tenant_id: str
    role: str
    token_limit: int
    tokens_used: int
    tokens_remaining: int
    cost_used: float
    cost_limit: float
    cost_remaining: float
    total_tokens_lifetime: int
    total_cost_lifetime: float
    created_at: str


# --- Dependencies ---

async def get_current_user_from_cookie(
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to extract current user from httpOnly cookie.
    JWT now contains tenant_id and role.
    """
    if not access_token:
        logger.warning("No access token in cookie")
        raise AuthenticationError("Not authenticated")

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise AuthenticationError("Invalid token payload")
    except JWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        raise AuthenticationError("Invalid or expired token")

    user = auth_service.get_user_by_email(db, email=email)
    if user is None:
        raise AuthenticationError("User not found")
    if not user.is_active:
        raise AuthenticationError("Your account is pending admin activation")

    return user


# --- Routes ---

@router.get("/tenants")
@limiter.limit("30/minute")
async def list_tenants_public(request: Request, db: Session = Depends(get_db)):
    """Public endpoint: list active tenants for registration dropdown.
    Returns only id and name — no sensitive data exposed."""
    tenants = db.query(Tenant.id, Tenant.name, Tenant.name_ar).filter(
        Tenant.is_active == True,
        Tenant.is_system == False
    ).order_by(Tenant.name).all()
    return [{"id": str(t.id), "name": t.name, "name_ar": t.name_ar} for t in tenants]


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def register_user(
    request: Request,
    user_data: UserRegister,
    db: Session = Depends(get_db)
):
    """Register new user under an existing tenant. User is inactive until admin activates."""
    # Validate tenant exists and is active
    tenant = db.query(Tenant).filter(Tenant.id == user_data.tenant_id, Tenant.is_active == True, Tenant.is_system == False).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or inactive organization")

    # Check if email already exists
    existing_user = auth_service.get_user_by_email(db, user_data.email)
    if existing_user:
        logger.warning(f"Registration attempted for existing email: {user_data.email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Register user under the selected tenant (inactive member)
    new_user = auth_service.register_user(
        db, email=user_data.email, username=user_data.username,
        password=user_data.password, tenant_id=user_data.tenant_id
    )

    logger.info(f"New user registered (pending activation): {new_user.email}",
                extra={"user_id": str(new_user.id), "tenant_id": str(new_user.tenant_id)})
    return {"message": "Account created successfully. Pending admin activation.", "pending_activation": True}


@router.post("/token", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login_for_access_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint (OAuth2 form) - sets JWT in httpOnly cookie.
    Username field accepts email address.
    """
    # OAuth2PasswordRequestForm uses 'username' field, but we authenticate by email
    user = auth_service.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        logger.warning(f"Failed login attempt for: {form_data.username}")
        raise AuthenticationError("Incorrect email or password")

    # Create token with multi-tenant claims
    token_data = auth_service.create_token_for_user(user)
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

    logger.info(f"User logged in: {user.email}", extra={"user_id": str(user.id), "tenant_id": str(user.tenant_id)})

    return {
        "message": "Login successful",
        "csrf_token": csrf_token
    }


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login_with_json(
    request: Request,
    response: Response,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login endpoint (JSON body) - alternative to OAuth2 form login.
    """
    user = auth_service.authenticate_user(db, login_data.email, login_data.password)
    if not user:
        logger.warning(f"Failed login attempt for: {login_data.email}")
        raise AuthenticationError("Incorrect email or password")

    token_data = auth_service.create_token_for_user(user)
    access_token = token_data["access_token"]
    csrf_token = generate_csrf_token()

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        domain=settings.COOKIE_DOMAIN
    )

    logger.info(f"User logged in (JSON): {user.email}", extra={"user_id": str(user.id)})

    return {
        "message": "Login successful",
        "csrf_token": csrf_token
    }


@router.post("/logout")
async def logout(response: Response):
    """Logout endpoint - clears auth cookie"""
    response.delete_cookie(
        key="access_token",
        domain=settings.COOKIE_DOMAIN
    )
    logger.info("User logged out")
    return {"message": "Logout successful"}


@router.get("/me", response_model=UserInfoResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user_from_cookie)):
    """Get current authenticated user info including tenant and role"""
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "tenant_id": str(current_user.tenant_id),
        "role": current_user.role,
        "token_limit": current_user.token_limit,
        "tokens_used": current_user.tokens_used,
        "tokens_remaining": max(0, current_user.token_limit - current_user.tokens_used),
        "cost_used": current_user.cost_used,
        "cost_limit": current_user.cost_limit,
        "cost_remaining": round(max(0, current_user.cost_limit - current_user.cost_used), 2),
        "total_tokens_lifetime": current_user.total_tokens_lifetime,
        "total_cost_lifetime": round(current_user.total_cost_lifetime, 6),
        "created_at": current_user.created_at.isoformat()
    }


@router.get("/csrf")
@limiter.limit("10/minute")
async def get_csrf_token(request: Request):
    """Get a new CSRF token for authenticated requests"""
    csrf_token = generate_csrf_token()
    return {"csrf_token": csrf_token}


# Export for use in other routes
get_current_user = get_current_user_from_cookie
