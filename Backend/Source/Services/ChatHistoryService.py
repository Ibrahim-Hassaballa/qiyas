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

    def create_conversation(self, user_id: int, title: str = "New Chat") -> Conversation:
        db = self.get_db()
        try:
            conversation = Conversation(user_id=user_id, title=title)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            return conversation
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating conversation for user {user_id}: {e}", exc_info=True)
            raise
        finally:
            db.close()

    def get_user_conversations(self, user_id: int, search_query: str = None):
        """
        Get all conversations for a user, optionally filtered by search query.
        
        Args:
            user_id: The user ID
            search_query: Optional search string to filter by title or message content
            
        Returns:
            List of Conversation objects matching the criteria
        """
        db = self.get_db()
        try:
            query = db.query(Conversation).filter(Conversation.user_id == user_id)
            
            if search_query:
                search_pattern = f"%{search_query}%"
                # Search in title OR in any message content
                query = query.outerjoin(Message).filter(
                    (Conversation.title.ilike(search_pattern)) |
                    (Message.content.ilike(search_pattern))
                ).distinct()
            
            return query.order_by(Conversation.created_at.desc()).all()
        finally:
            db.close()

    def get_conversation_history(
        self,
        conversation_id: int,
        user_id: int,
        skip: int = 0,
        limit: int = 50
    ) -> Optional[Tuple[List[Message], int]]:
        """
        Get conversation history with pagination.

        Args:
            conversation_id: The conversation ID
            user_id: The user ID for ownership verification
            skip: Number of messages to skip (default 0)
            limit: Maximum messages to return (default 50)

        Returns:
            Tuple of (messages list, total count) or None if not found/unauthorized
        """
        db = self.get_db()
        try:
            # Verify conversation ownership
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
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
        conversation_id: int,
        user_id: int,
        limit: int = 8
    ) -> Optional[List[Message]]:
        """
        Get the most recent messages for a conversation (for chat context building).

        Args:
            conversation_id: The conversation ID
            user_id: The user ID for ownership verification
            limit: Maximum number of recent messages to return (default 8)

        Returns:
            List of most recent messages in chronological order, or None if not found/unauthorized
        """
        db = self.get_db()
        try:
            # Verify conversation ownership
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
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

    def add_message(self, conversation_id: int, role: str, content: str, attachment_name: str = None, attachment_content: str = None):
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

    def delete_conversation(self, conversation_id: int, user_id: int):
        db = self.get_db()
        try:
            # Check ownership
            conversation = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.user_id == user_id).first()
            if not conversation:
                return False

            # Delete from SQLite (Reference Cascade should handle messages, but let's be safe if not configured)
            # The model definition has cascade="all, delete-orphan", so deleting conversation deletes messages.
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
