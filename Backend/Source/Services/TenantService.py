"""
Tenant Management Service — CRUD operations for tenants (admin only).
"""
import re
import uuid as uuid_mod
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from Backend.Source.Models.Tenant import Tenant
from Backend.Source.Models.User import User
from Backend.Source.Models.ChatModels import Conversation
from Backend.Source.Models.UsageReset import UsageReset
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import ResourceNotFoundError, ValidationError


def _generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a tenant name."""
    slug = name.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    return slug


class TenantService:

    def list_tenants(
        self, db: Session, skip: int = 0, limit: int = 50
    ) -> dict:
        """List all tenants with user count, paginated."""
        total = db.query(func.count(Tenant.id)).scalar()

        tenants = (
            db.query(Tenant)
            .order_by(Tenant.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        items = []
        for t in tenants:
            user_count = db.query(func.count(User.id)).filter(User.tenant_id == t.id).scalar()
            items.append({
                "id": str(t.id),
                "name": t.name,
                "name_ar": t.name_ar,
                "slug": t.slug,
                "plan": t.plan,
                "is_active": t.is_active,
                "is_system": t.is_system,
                "user_count": user_count,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            })

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    def get_tenant(self, db: Session, tenant_id: str) -> dict:
        """Get a single tenant with its users."""
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ResourceNotFoundError(f"Tenant {tenant_id} not found")

        users = db.query(User).filter(User.tenant_id == tenant.id).all()
        return {
            "id": str(tenant.id),
            "name": tenant.name,
            "name_ar": tenant.name_ar,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "is_active": tenant.is_active,
            "is_system": tenant.is_system,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
            "users": [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "username": u.username,
                    "role": u.role,
                    "is_active": u.is_active,
                }
                for u in users
            ],
        }

    def create_tenant(
        self, db: Session, name: str, plan: str = "free", slug: Optional[str] = None, name_ar: Optional[str] = None
    ) -> dict:
        """Create a new tenant."""
        slug = slug or _generate_slug(name)

        existing = db.query(Tenant).filter(Tenant.slug == slug).first()
        if existing:
            raise ValidationError(f"Tenant with slug '{slug}' already exists")

        tenant = Tenant(name=name, slug=slug, plan=plan, name_ar=name_ar)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)

        logger.info(f"Created tenant '{name}' (slug: {slug})")
        return {
            "id": str(tenant.id),
            "name": tenant.name,
            "name_ar": tenant.name_ar,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "is_active": tenant.is_active,
            "is_system": tenant.is_system,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        }

    def update_tenant(
        self,
        db: Session,
        tenant_id: str,
        name: Optional[str] = None,
        slug: Optional[str] = None,
        plan: Optional[str] = None,
        is_active: Optional[bool] = None,
        name_ar: Optional[str] = None,
    ) -> dict:
        """Update an existing tenant."""
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ResourceNotFoundError(f"Tenant {tenant_id} not found")

        if name is not None:
            tenant.name = name
        if slug is not None:
            dup = db.query(Tenant).filter(Tenant.slug == slug, Tenant.id != tenant_id).first()
            if dup:
                raise ValidationError(f"Slug '{slug}' is already taken")
            tenant.slug = slug
        if plan is not None:
            if plan not in ("free", "pro", "enterprise"):
                raise ValidationError(f"Invalid plan '{plan}'. Must be free, pro, or enterprise.")
            tenant.plan = plan
        if is_active is not None:
            tenant.is_active = is_active
        if name_ar is not None:
            tenant.name_ar = name_ar

        db.commit()
        db.refresh(tenant)

        logger.info(f"Updated tenant {tenant_id}")
        return {
            "id": str(tenant.id),
            "name": tenant.name,
            "name_ar": tenant.name_ar,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "is_active": tenant.is_active,
            "is_system": tenant.is_system,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        }

    def delete_tenant(self, db: Session, tenant_id: str) -> dict:
        """Permanently delete a tenant and all associated data."""
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ResourceNotFoundError(f"Tenant {tenant_id} not found")

        if tenant.is_system:
            raise ValidationError("Cannot delete the system tenant")

        tenant_name = tenant.name

        try:
            # Collect IDs for cascade cleanup
            user_ids = [u.id for u in db.query(User.id).filter(User.tenant_id == tenant_id).all()]
            user_count = len(user_ids)

            if user_ids:
                # Get all conversation IDs for these users
                conv_ids = [
                    c.id for c in db.query(Conversation.id)
                    .filter(Conversation.user_id.in_(user_ids))
                    .all()
                ]

                # Clean up ChromaDB session data for each conversation
                if conv_ids:
                    from Backend.Source.Services.KnowledgeBaseService import get_kb_service
                    try:
                        kb_service = get_kb_service()
                        for cid in conv_ids:
                            kb_service.delete_session_data(cid)
                    except Exception as e:
                        logger.warning(f"ChromaDB cleanup failed during tenant deletion: {e}")

                # Delete usage_resets referencing any of the tenant's users
                db.query(UsageReset).filter(
                    (UsageReset.user_id.in_(user_ids)) | (UsageReset.reset_by.in_(user_ids))
                ).delete(synchronize_session=False)

                # Delete conversations (messages cascade via relationship)
                db.query(Conversation).filter(Conversation.user_id.in_(user_ids)).delete(synchronize_session=False)

            # Delete tenant — users cascade via SQLAlchemy relationship
            db.delete(tenant)
            db.commit()

            logger.info(f"Permanently deleted tenant '{tenant_name}' ({tenant_id}) and {user_count} users")
            return {"message": f"Tenant '{tenant_name}' permanently deleted"}

        except (ResourceNotFoundError, ValidationError):
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete tenant {tenant_id}: {e}", exc_info=True)
            raise ValidationError(f"Failed to delete tenant: {e}")


tenant_service = TenantService()
