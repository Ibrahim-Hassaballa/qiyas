from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel, Field
from Backend.Source.Services.ChatHistoryService import chat_history_service
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Models.User import User
from Backend.Source.Utils.CSRF import verify_csrf
from Backend.Source.Core.Logging import logger

router = APIRouter(prefix="/api/history", tags=["History"])

# Pydantic Schemas for Response
class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: str

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: int
    role: str
    content: str
    attachment_name: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class CreateConversationRequest(BaseModel):
    title: str = Field(default="New Chat", max_length=500, min_length=1)


@router.get("/", response_model=List[ConversationResponse])
def get_conversations(
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Search query to filter by title or message content")
):
    """
    Get all conversations for the current user.
    Optional: filter by search query (matches title or message content).
    """
    conversations = chat_history_service.get_user_conversations(current_user.id, search_query=q)
    # Format dates to string
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat()
        }
        for c in conversations
    ]


@router.post("/", response_model=ConversationResponse)
def create_conversation(
    request: CreateConversationRequest,
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf)
):
    # Sanitize title (remove potential XSS)
    safe_title = request.title.strip()[:500]
    conversation = chat_history_service.create_conversation(current_user.id, safe_title)
    return {
        "id": conversation.id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat()
    }


class PaginatedMessagesResponse(BaseModel):
    messages: List[MessageResponse]
    total: int
    skip: int
    limit: int
    has_more: bool


@router.get("/{conversation_id}", response_model=PaginatedMessagesResponse)
def get_conversation_history(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0, description="Number of messages to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum messages to return")
):
    """
    Get conversation history with pagination.
    Returns messages in chronological order (oldest first).
    """
    result = chat_history_service.get_conversation_history(
        conversation_id, current_user.id, skip=skip, limit=limit
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    messages, total = result
    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "attachment_name": m.attachment_name,
                "created_at": m.created_at.isoformat()
            }
            for m in messages
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(messages) < total
    }


@router.delete("/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf)
):
    # Verify ownership before delete (defense in depth)
    result = chat_history_service.get_conversation_history(conversation_id, current_user.id, limit=1)
    if result is None:
        logger.warning(f"User {current_user.id} attempted to delete conversation {conversation_id} without access")
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    success = chat_history_service.delete_conversation(conversation_id, current_user.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete conversation")

    logger.info(f"User {current_user.id} deleted conversation {conversation_id}")
    return {"status": "success", "message": "Conversation deleted"}
