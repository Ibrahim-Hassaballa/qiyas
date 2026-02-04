from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from Backend.Source.Core.Database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="New Chat")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to Messages
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    role = Column(String)  # 'user' or 'assistant'
    content = Column(Text)
    
    # Attachment persistence for Dual RAG context resumption
    attachment_name = Column(String, nullable=True)
    attachment_content = Column(Text, nullable=True) # Extracted text content
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to Conversation
    conversation = relationship("Conversation", back_populates="messages")
