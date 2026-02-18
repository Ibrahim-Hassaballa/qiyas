import uuid
from sqlalchemy import Column, Integer, BigInteger, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from Backend.Source.Core.Database import Base


class UsageReset(Base):
    __tablename__ = "usage_resets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tokens_used_before_reset = Column(BigInteger, nullable=False)
    cost_used_before_reset = Column(Float, nullable=False)
    reset_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reset_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[reset_by])
