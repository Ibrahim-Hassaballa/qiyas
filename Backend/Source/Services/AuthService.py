from sqlalchemy.orm import Session
from Backend.Source.Models.User import User
from Backend.Source.Models.Tenant import Tenant
from Backend.Source.Core.Security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import AccountInactiveError


class AuthService:
    def get_user_by_email(self, db: Session, email: str):
        """Lookup user by email (primary identifier)"""
        return db.query(User).filter(User.email == email).first()

    def get_user_by_username(self, db: Session, username: str):
        """Lookup user by username (backward compat)"""
        return db.query(User).filter(User.username == username).first()

    def register_user(self, db: Session, email: str, username: str, password: str, tenant_id: str):
        """
        Register a new user under an existing tenant.
        User is created as inactive member — admin must activate.
        """
        hashed_password = get_password_hash(password)
        user = User(
            tenant_id=tenant_id,
            email=email,
            username=username,
            hashed_password=hashed_password,
            role="member",
            is_active=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        logger.info(f"Registered user '{email}' as member of tenant {tenant_id}")
        return user

    def create_user_in_tenant(self, db: Session, tenant_id, email: str, username: str, password: str, role: str = "member"):
        """Add a user to an existing tenant (invite flow)"""
        hashed_password = get_password_hash(password)
        user = User(
            tenant_id=tenant_id,
            email=email,
            username=username,
            hashed_password=hashed_password,
            role=role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        logger.info(f"Added user '{email}' to tenant {tenant_id} with role '{role}'")
        return user

    def authenticate_user(self, db: Session, email: str, password: str):
        """Authenticate by email + password. Verifies password before checking active status."""
        user = self.get_user_by_email(db, email)
        if not user:
            return False
        if not verify_password(password, user.hashed_password):
            return False
        if not user.is_active:
            logger.warning(f"Login attempt for inactive user: {email}")
            raise AccountInactiveError(
                "Your account is pending admin activation. Please contact your administrator.",
                details={"error_code": "ACCOUNT_INACTIVE"}
            )
        return user

    def create_token_for_user(self, user: User):
        """Create JWT with tenant_id, role, and user_id in claims"""
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.email,
                "tenant_id": str(user.tenant_id),
                "role": user.role,
                "user_id": str(user.id),
            },
            expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}

    def create_default_admin_if_not_exists(self, db: Session):
        """Creates a default admin tenant + user if no users exist"""
        user_count = db.query(User).count()
        if user_count == 0:
            logger.info("No users found. Creating default admin user...")

            # Create default tenant
            tenant = db.query(Tenant).filter(Tenant.slug == "qiyas").first()
            if not tenant:
                tenant = Tenant(name="Qiyas", slug="qiyas", is_system=True, name_ar="قياس")
                db.add(tenant)
                db.flush()

            # Create admin user under default tenant
            admin_user = self.register_user(
                db, email="admin@qiyas.ai", username="Admin",
                password="QiyasAdmin2025!", tenant_id=str(tenant.id)
            )
            admin_user.is_active = True
            admin_user.role = "owner"
            db.commit()
            logger.info("Default admin user created and activated.")
        else:
            logger.info(f"Database has {user_count} existing user(s). Skipping default admin creation.")


auth_service = AuthService()
