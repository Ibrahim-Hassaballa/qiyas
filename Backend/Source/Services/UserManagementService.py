"""
User Management Service — Cross-tenant CRUD operations for users (admin only).
"""
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from Backend.Source.Models.User import User
from Backend.Source.Models.Tenant import Tenant
from Backend.Source.Models.UsageReset import UsageReset
from Backend.Source.Models.ChatModels import Conversation
from Backend.Source.Core.Security import get_password_hash
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import ResourceNotFoundError, ValidationError, TokenLimitExceededError


class UserManagementService:

    def _user_dict(self, user: User, tenant_name: str) -> dict:
        """Build a standard user response dict including token and cost fields."""
        return {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "is_active": user.is_active,
            "tenant_id": str(user.tenant_id),
            "tenant_name": tenant_name,
            "token_limit": user.token_limit,
            "tokens_used": user.tokens_used,
            "tokens_remaining": max(0, user.token_limit - user.tokens_used),
            "cost_used": user.cost_used,
            "cost_limit": user.cost_limit,
            "cost_remaining": round(max(0, user.cost_limit - user.cost_used), 6),
            "total_tokens_lifetime": user.total_tokens_lifetime,
            "total_cost_lifetime": round(user.total_cost_lifetime, 6),
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

    def list_users(
        self, db: Session, skip: int = 0, limit: int = 50, tenant_id: Optional[str] = None
    ) -> dict:
        """List all users, optionally filtered by tenant."""
        query = db.query(User)
        count_query = db.query(func.count(User.id))

        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
            count_query = count_query.filter(User.tenant_id == tenant_id)

        total = count_query.scalar()
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

        items = []
        for u in users:
            tenant = db.query(Tenant).filter(Tenant.id == u.tenant_id).first()
            items.append(self._user_dict(u, tenant.name if tenant else "Unknown"))

        return {"items": items, "total": total, "skip": skip, "limit": limit}

    def get_user(self, db: Session, user_id: str) -> dict:
        """Get a single user with tenant info."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        return self._user_dict(user, tenant.name if tenant else "Unknown")

    def create_user(
        self,
        db: Session,
        tenant_id: str,
        email: str,
        username: str,
        password: str,
        role: str = "member",
    ) -> dict:
        """Create a user in any tenant."""
        # Validate tenant exists
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ResourceNotFoundError(f"Tenant {tenant_id} not found")

        # Check email uniqueness
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise ValidationError(f"Email '{email}' is already registered")

        if role not in ("owner", "admin", "member"):
            raise ValidationError(f"Invalid role '{role}'. Must be owner, admin, or member.")

        user = User(
            tenant_id=tenant_id,
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"Admin created user '{email}' in tenant '{tenant.name}' with role '{role}'")
        return self._user_dict(user, tenant.name)

    def update_user(
        self,
        db: Session,
        user_id: str,
        tenant_id: Optional[str] = None,
        email: Optional[str] = None,
        username: Optional[str] = None,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        token_limit: Optional[int] = None,
        cost_limit: Optional[float] = None,
    ) -> dict:
        """Update a user's details."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        if tenant_id is not None:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.is_active == True).first()
            if not tenant:
                raise ValidationError(f"Tenant '{tenant_id}' not found or is inactive")
            user.tenant_id = tenant_id

        if email is not None:
            dup = db.query(User).filter(User.email == email, User.id != user_id).first()
            if dup:
                raise ValidationError(f"Email '{email}' is already taken")
            user.email = email
        if username is not None:
            user.username = username
        if role is not None:
            if role not in ("owner", "admin", "member"):
                raise ValidationError(f"Invalid role '{role}'. Must be owner, admin, or member.")
            user.role = role
        if is_active is not None:
            user.is_active = is_active
        if token_limit is not None:
            if token_limit < 0:
                raise ValidationError("Token limit must be non-negative")
            user.token_limit = token_limit
        if cost_limit is not None:
            if cost_limit < 0:
                raise ValidationError("Cost limit must be non-negative")
            user.cost_limit = cost_limit

        db.commit()
        db.refresh(user)

        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        logger.info(f"Admin updated user {user_id}")
        return self._user_dict(user, tenant.name if tenant else "Unknown")

    def delete_user(self, db: Session, user_id: str, current_user_id: str = None) -> dict:
        """Permanently delete a user and all associated data."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        if current_user_id and str(user.id) == str(current_user_id):
            raise ValidationError("Cannot delete your own account")

        user_email = user.email

        try:
            # Get all conversation IDs for this user
            conv_ids = [
                c.id for c in db.query(Conversation.id)
                .filter(Conversation.user_id == user.id)
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
                    logger.warning(f"ChromaDB cleanup failed during user deletion: {e}")

            # Delete usage_resets where this user is the subject or the admin who reset
            db.query(UsageReset).filter(
                (UsageReset.user_id == user.id) | (UsageReset.reset_by == user.id)
            ).delete(synchronize_session=False)

            # Delete conversations (messages cascade via relationship)
            db.query(Conversation).filter(Conversation.user_id == user.id).delete(synchronize_session=False)

            # Delete the user
            db.delete(user)
            db.commit()

            logger.info(f"Permanently deleted user {user_id} ({user_email})")
            return {"message": f"User '{user_email}' permanently deleted"}

        except (ResourceNotFoundError, ValidationError):
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to delete user {user_id}: {e}", exc_info=True)
            raise ValidationError(f"Failed to delete user: {e}")

    # ── Token management ──

    def check_token_limit(self, db: Session, user_id) -> dict:
        """Check a user's token usage against their limit. Raises TokenLimitExceededError if exhausted."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        remaining = max(0, user.token_limit - user.tokens_used)
        if remaining <= 0:
            raise TokenLimitExceededError(
                f"Token limit exceeded. Used {user.tokens_used:,} of {user.token_limit:,} tokens. "
                "Please contact your administrator to reset or increase your limit."
            )
        return {
            "token_limit": user.token_limit,
            "tokens_used": user.tokens_used,
            "tokens_remaining": remaining,
        }

    def check_cost_limit(self, db: Session, user_id) -> dict:
        """Check a user's cost usage against their budget. Raises TokenLimitExceededError if exhausted."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        if user.cost_used >= user.cost_limit:
            raise TokenLimitExceededError(
                f"Budget exceeded. Used ${user.cost_used:.2f} of ${user.cost_limit:.2f}. "
                "Contact your administrator."
            )
        return {
            "cost_limit": user.cost_limit,
            "cost_used": user.cost_used,
            "cost_remaining": round(max(0, user.cost_limit - user.cost_used), 6),
        }

    def increment_tokens_used(self, db: Session, user_id, tokens: int) -> None:
        """Atomically increment a user's tokens_used and lifetime counter."""
        if tokens <= 0:
            return
        db.query(User).filter(User.id == user_id).update({
            User.tokens_used: User.tokens_used + tokens,
            User.total_tokens_lifetime: User.total_tokens_lifetime + tokens,
        })
        db.commit()
        logger.info(f"Incremented tokens_used for user {user_id} by {tokens}")

    def increment_cost_used(self, db: Session, user_id, cost: float) -> None:
        """Atomically increment a user's cost_used and lifetime counter."""
        if cost <= 0:
            return
        db.query(User).filter(User.id == user_id).update({
            User.cost_used: User.cost_used + cost,
            User.total_cost_lifetime: User.total_cost_lifetime + cost,
        })
        db.commit()
        logger.info(f"Incremented cost_used for user {user_id} by ${cost:.6f}")

    def reset_tokens_used(self, db: Session, user_id: str, reset_by: str = None) -> dict:
        """Reset a user's tokens_used and cost_used to 0, logging a snapshot to usage_resets."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        # No-op guard: skip if nothing to reset
        if user.tokens_used == 0 and user.cost_used == 0.0:
            return {"message": f"No usage to reset for '{user.email}'"}

        # Create audit record with current values before zeroing
        if reset_by:
            reset_record = UsageReset(
                user_id=user.id,
                tokens_used_before_reset=user.tokens_used,
                cost_used_before_reset=user.cost_used,
                reset_by=reset_by,
            )
            db.add(reset_record)

        # Zero period counters (lifetime untouched)
        user.tokens_used = 0
        user.cost_used = 0.0
        db.commit()
        logger.info(f"Admin reset token/cost usage for user {user_id} ({user.email})")
        return {"message": f"Usage reset for '{user.email}'"}

    def get_usage_history(self, db: Session, user_id: str) -> list:
        """Return the last 50 usage reset records for a user."""
        resets = (
            db.query(UsageReset)
            .filter(UsageReset.user_id == user_id)
            .order_by(UsageReset.reset_at.desc())
            .limit(50)
            .all()
        )
        results = []
        for r in resets:
            admin_user = r.admin
            results.append({
                "id": r.id,
                "tokens_used_before_reset": r.tokens_used_before_reset,
                "cost_used_before_reset": round(r.cost_used_before_reset, 6),
                "reset_by": str(r.reset_by),
                "reset_by_username": admin_user.username if admin_user else "Unknown",
                "reset_by_email": admin_user.email if admin_user else "Unknown",
                "reset_at": r.reset_at.isoformat() if r.reset_at else None,
            })
        return results

    def reset_password(self, db: Session, user_id: str, new_password: str) -> dict:
        """Admin password reset for a user."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ResourceNotFoundError(f"User {user_id} not found")

        if len(new_password) < 6:
            raise ValidationError("Password must be at least 6 characters")

        user.hashed_password = get_password_hash(new_password)
        db.commit()

        logger.info(f"Admin reset password for user {user_id} ({user.email})")
        return {"message": f"Password reset for '{user.email}'"}


user_management_service = UserManagementService()
