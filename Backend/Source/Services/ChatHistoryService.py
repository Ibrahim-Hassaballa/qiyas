from sqlalchemy.orm import Session
from sqlalchemy import func
from Backend.Source.Models.ChatModels import Conversation, Message
from Backend.Source.Core.Database import SessionLocal
from Backend.Source.Services.KnowledgeBaseService import get_kb_service
from datetime import datetime
from typing import Optional, Tuple, List
from Backend.Source.Core.Logging import logger

class ChatHistoryService:
    def __init__(self):
        self.kb_service = get_kb_service()

    def get_db(self):
        return SessionLocal()

    def create_conversation(self, user_id, tenant_id, title: str = "New Chat") -> Conversation:
        """Create a new conversation scoped to a tenant."""
        db = self.get_db()
        try:
            conversation = Conversation(user_id=user_id, tenant_id=tenant_id, title=title)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            return conversation
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating conversation for user {user_id} in tenant {tenant_id}: {e}", exc_info=True)
            raise
        finally:
            db.close()

    def get_user_conversations(self, user_id, tenant_id, search_query: str = None):
        """
        Get all conversations for a user within their tenant.
        Defense-in-depth: filters by BOTH user_id AND tenant_id.
        """
        db = self.get_db()
        try:
            query = db.query(Conversation).filter(
                Conversation.user_id == user_id,
                Conversation.tenant_id == tenant_id
            )
            
            if search_query:
                search_pattern = f"%{search_query}%"
                query = query.outerjoin(Message).filter(
                    (Conversation.title.ilike(search_pattern)) |
                    (Message.content.ilike(search_pattern))
                ).distinct()
            
            return query.order_by(Conversation.created_at.desc()).all()
        finally:
            db.close()

    def get_conversation_history(
        self,
        conversation_id,
        user_id,
        tenant_id,
        skip: int = 0,
        limit: int = 50
    ) -> Optional[Tuple[List[Message], int]]:
        """
        Get conversation history with pagination.
        Verifies ownership by user_id AND tenant_id.
        """
        db = self.get_db()
        try:
            # Verify conversation ownership (defense-in-depth: both user and tenant)
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.tenant_id == tenant_id
            ).first()
            if not conversation:
                return None

            # Get total count
            total = db.query(func.count(Message.id)).filter(
                Message.conversation_id == conversation_id
            ).scalar()

            # Get paginated messages (chronological order)
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at.asc()).offset(skip).limit(limit).all()

            return messages, total
        finally:
            db.close()

    def get_recent_messages(
        self,
        conversation_id,
        user_id,
        tenant_id,
        limit: int = 8
    ) -> Optional[List[Message]]:
        """
        Get the most recent messages for a conversation (for chat context building).
        Verifies ownership by user_id AND tenant_id.
        """
        db = self.get_db()
        try:
            # Verify conversation ownership
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.tenant_id == tenant_id
            ).first()
            if not conversation:
                return None

            # Get last N messages (order by desc, then reverse for chronological)
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at.desc()).limit(limit).all()

            # Reverse to get chronological order
            return list(reversed(messages))
        finally:
            db.close()

    def add_message(self, conversation_id, role: str, content: str, attachment_name: str = None, attachment_content: str = None):
        """Add a message to a conversation. No tenant check needed here since conversation_id is already validated."""
        db = self.get_db()
        try:
            message = Message(
                conversation_id=conversation_id,
                role=role,
                content=content,
                attachment_name=attachment_name,
                attachment_content=attachment_content
            )
            db.add(message)
            db.commit()
            db.refresh(message)
            return message
        except Exception as e:
            db.rollback()
            logger.error(f"Error adding message to conversation {conversation_id}: {e}", exc_info=True)
            raise
        finally:
            db.close()

    def delete_conversation(self, conversation_id, user_id, tenant_id):
        """Delete a conversation with tenant isolation."""
        db = self.get_db()
        try:
            # Check ownership with tenant scoping
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.tenant_id == tenant_id
            ).first()
            if not conversation:
                return False

            db.delete(conversation)
            db.commit()
            
            # Sync with RAG: Delete from Session Knowledge Base
            self.kb_service.delete_session_data(conversation_id)
            
            return True
        except Exception as e:
            logger.error(f"Error deleting conversation {conversation_id} for user {user_id}: {e}", exc_info=True)
            db.rollback()
            return False
        finally:
            db.close()

chat_history_service = ChatHistoryService()
