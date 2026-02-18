"""
Admin API Routes — Tenant CRUD, User CRUD, Analytics, Health, and Logs.
All endpoints require admin or owner role.
"""
import time
import os
from collections import deque
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from Backend.Source.Core.Database import get_db
from Backend.Source.Core.Dependencies import require_role
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Models.Tenant import Tenant
from Backend.Source.Models.User import User
from Backend.Source.Models.ChatModels import Conversation, Message
from Backend.Source.Services.TenantService import tenant_service
from Backend.Source.Services.UserManagementService import user_management_service

router = APIRouter()

# Track server start time for uptime calculation
_server_start_time = time.time()


# ────────────────────────────────────────
# Pydantic Schemas
# ────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    plan: str = "free"
    slug: Optional[str] = None
    name_ar: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    name_ar: Optional[str] = None


class UserCreate(BaseModel):
    tenant_id: str
    email: str
    username: str
    password: str
    role: str = "member"


class UserUpdate(BaseModel):
    tenant_id: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    token_limit: Optional[int] = None
    cost_limit: Optional[float] = None


class PasswordReset(BaseModel):
    new_password: str


# ────────────────────────────────────────
# Tenant CRUD
# ────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """List all tenants with user counts (paginated)."""
    return tenant_service.list_tenants(db, skip=skip, limit=limit)


@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Get tenant details including users."""
    return tenant_service.get_tenant(db, tenant_id)


@router.post("/tenants", status_code=201)
async def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Create a new tenant organization."""
    return tenant_service.create_tenant(db, name=data.name, plan=data.plan, slug=data.slug, name_ar=data.name_ar)


@router.put("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    data: TenantUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Update tenant details."""
    return tenant_service.update_tenant(
        db, tenant_id,
        name=data.name, slug=data.slug, plan=data.plan, is_active=data.is_active,
        name_ar=data.name_ar,
    )


@router.delete("/tenants/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Permanently delete a tenant and all its users and data."""
    return tenant_service.delete_tenant(db, tenant_id)


# ────────────────────────────────────────
# User CRUD
# ────────────────────────────────────────

@router.get("/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    tenant_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """List all users, optionally filtered by tenant."""
    return user_management_service.list_users(db, skip=skip, limit=limit, tenant_id=tenant_id)


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Get user details."""
    return user_management_service.get_user(db, user_id)


@router.post("/users", status_code=201)
async def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Create a user in any tenant."""
    return user_management_service.create_user(
        db,
        tenant_id=data.tenant_id,
        email=data.email,
        username=data.username,
        password=data.password,
        role=data.role,
    )


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Update user details."""
    return user_management_service.update_user(
        db, user_id,
        tenant_id=data.tenant_id,
        email=data.email, username=data.username, role=data.role,
        is_active=data.is_active, token_limit=data.token_limit,
        cost_limit=data.cost_limit,
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "owner")),
):
    """Permanently delete a user and all their data."""
    return user_management_service.delete_user(db, user_id, current_user_id=str(current_user.id))


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: str,
    data: PasswordReset,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Reset a user's password."""
    return user_management_service.reset_password(db, user_id, data.new_password)


@router.post("/users/{user_id}/reset-tokens")
async def reset_tokens(
    user_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_role("admin", "owner")),
):
    """Reset a user's token usage to zero (creates audit record)."""
    return user_management_service.reset_tokens_used(db, user_id, reset_by=str(current_user.id))


@router.get("/users/{user_id}/usage-history")
async def get_usage_history(
    user_id: str,
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Get usage reset history for a user."""
    return {"user_id": user_id, "resets": user_management_service.get_usage_history(db, user_id)}


# ────────────────────────────────────────
# Analytics
# ────────────────────────────────────────

@router.get("/analytics")
async def get_analytics(
    db: Session = Depends(get_db),
    _user=Depends(require_role("admin", "owner")),
):
    """Dashboard analytics: counts and recent activity."""
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_tenants = db.query(func.count(Tenant.id)).scalar()
    active_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar()
    total_users = db.query(func.count(User.id)).scalar()
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    total_conversations = db.query(func.count(Conversation.id)).scalar()
    total_messages = db.query(func.count(Message.id)).scalar()

    conversations_today = (
        db.query(func.count(Conversation.id))
        .filter(Conversation.created_at >= today_start)
        .scalar()
    )
    messages_today = (
        db.query(func.count(Message.id))
        .filter(Message.created_at >= today_start)
        .scalar()
    )
    new_users_week = (
        db.query(func.count(User.id))
        .filter(User.created_at >= week_ago)
        .scalar()
    )

    # Plan distribution
    plan_dist = (
        db.query(Tenant.plan, func.count(Tenant.id))
        .group_by(Tenant.plan)
        .all()
    )

    # Role distribution
    role_dist = (
        db.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )

    # Recent conversations (last 10)
    recent_convos = (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc())
        .limit(10)
        .all()
    )

    # Token usage stats
    total_tokens_consumed = db.query(func.coalesce(func.sum(User.tokens_used), 0)).scalar()
    users_at_limit = (
        db.query(func.count(User.id))
        .filter(User.tokens_used >= User.token_limit)
        .scalar()
    )
    top_token_consumers = (
        db.query(User.username, User.email, User.tokens_used, User.token_limit)
        .order_by(User.tokens_used.desc())
        .limit(5)
        .all()
    )

    # Cost usage stats
    total_cost = db.query(func.coalesce(func.sum(User.cost_used), 0.0)).scalar()
    users_at_cost_limit = (
        db.query(func.count(User.id))
        .filter(User.cost_used >= User.cost_limit)
        .scalar()
    )

    return {
        "totals": {
            "tenants": total_tenants,
            "active_tenants": active_tenants,
            "users": total_users,
            "active_users": active_users,
            "conversations": total_conversations,
            "messages": total_messages,
        },
        "today": {
            "conversations": conversations_today,
            "messages": messages_today,
        },
        "new_users_this_week": new_users_week,
        "plan_distribution": {plan: count for plan, count in plan_dist},
        "role_distribution": {role: count for role, count in role_dist},
        "recent_conversations": [
            {
                "id": str(c.id),
                "title": c.title,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in recent_convos
        ],
        "uptime_seconds": round(time.time() - _server_start_time, 1),
        "token_usage": {
            "total_consumed": total_tokens_consumed,
            "users_at_limit": users_at_limit,
            "total_cost": round(float(total_cost), 2),
            "users_at_cost_limit": users_at_cost_limit,
            "top_consumers": [
                {
                    "username": u.username,
                    "email": u.email,
                    "tokens_used": u.tokens_used,
                    "token_limit": u.token_limit,
                }
                for u in top_token_consumers
            ],
        },
    }


# ────────────────────────────────────────
# System Health
# ────────────────────────────────────────

@router.get("/health")
async def detailed_health(
    _user=Depends(require_role("admin", "owner")),
):
    """Detailed system health check for admin dashboard."""
    health = {
        "status": "ok",
        "uptime_seconds": round(time.time() - _server_start_time, 1),
        "components": {},
    }

    # Database check
    try:
        from Backend.Source.Core.Database import SessionLocal
        db = SessionLocal()
        db.execute(func.now() if not settings.DATABASE_URL.startswith("sqlite") else "SELECT 1")
        db.close()
        health["components"]["database"] = {"status": "healthy", "type": settings.DATABASE_URL.split("://")[0]}
    except Exception as e:
        health["components"]["database"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"

    # Redis check
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        health["components"]["redis"] = {"status": "healthy", "url": settings.REDIS_URL}
    except Exception as e:
        health["components"]["redis"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"

    # ChromaDB check
    try:
        import chromadb
        client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        collections = client.list_collections()
        health["components"]["chromadb"] = {
            "status": "healthy",
            "collections": len(collections),
            "path": settings.CHROMA_DB_PATH,
        }
    except Exception as e:
        health["components"]["chromadb"] = {"status": "unhealthy", "error": str(e)}
        health["status"] = "degraded"

    return health


# ────────────────────────────────────────
# Logs
# ────────────────────────────────────────

@router.get("/logs")
async def get_recent_logs(
    lines: int = Query(50, ge=1, le=500),
    level: Optional[str] = Query(None, description="Filter by log level: DEBUG, INFO, WARNING, ERROR"),
    _user=Depends(require_role("admin", "owner")),
):
    """Read recent log entries from the log file."""
    import json

    log_path = settings.LOG_FILE
    if not os.path.exists(log_path):
        return {"logs": [], "message": "Log file not found"}

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            # Read last N*3 lines to account for filtering
            all_lines = deque(f, maxlen=lines * 3)

        entries = []
        for line in all_lines:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                if level and entry.get("level", "").upper() != level.upper():
                    continue
                entries.append(entry)
            except json.JSONDecodeError:
                # Non-JSON log line (text format)
                if level and level.upper() not in line.upper():
                    continue
                entries.append({"raw": line})

        # Return the most recent entries
        return {"logs": entries[-lines:], "total": len(entries)}
    except Exception as e:
        logger.error(f"Failed to read logs: {e}")
        return {"logs": [], "error": str(e)}
