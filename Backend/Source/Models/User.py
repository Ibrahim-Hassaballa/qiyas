import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, BigInteger, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from Backend.Source.Core.Database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="member")  # owner | admin | member
    is_active = Column(Boolean, default=True)
    token_limit = Column(Integer, default=500000, nullable=False)
    tokens_used = Column(BigInteger, default=0, nullable=False)
    cost_used = Column(Float, default=0.0, nullable=False)
    cost_limit = Column(Float, default=5.0, nullable=False)
    total_tokens_lifetime = Column(BigInteger, default=0, nullable=False)
    total_cost_lifetime = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
