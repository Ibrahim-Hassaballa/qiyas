"""
Core dependencies for multi-tenant access control.
These FastAPI dependencies extract tenant context and enforce RBAC.
"""
from fastapi import Depends
from Backend.Source.Core.Exceptions import AuthorizationError
from Backend.Source.Core.Logging import logger
import uuid


def get_current_tenant(user=None):
    """
    Extract tenant_id from the authenticated user.
    Use as: tenant_id = Depends(get_current_tenant_dep)
    
    This is a simple accessor; the actual user is resolved by get_current_user
    in Auth.py which decodes the JWT.
    """
    if user is None:
        raise AuthorizationError("Authentication required")
    return user.tenant_id


def require_role(*allowed_roles):
    """
    RBAC dependency factory. Usage in routes:
    
        @router.get("/admin/users")
        async def list_users(user = Depends(require_role("admin", "owner"))):
            ...
    
    Returns a dependency that checks if the current user's role
    is in the allowed_roles list.
    """
    from Backend.Source.Api.Routes.Auth import get_current_user

    async def _check_role(user=Depends(get_current_user)):
        if user.role not in allowed_roles:
            logger.warning(
                f"RBAC denied: user {user.email} (role={user.role}) attempted action requiring {allowed_roles}"
            )
            raise AuthorizationError(
                f"This action requires one of: {', '.join(allowed_roles)}"
            )
        return user

    return _check_role
