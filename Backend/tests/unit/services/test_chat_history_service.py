"""
Unit tests for ChatHistoryService.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from Backend.Source.Services.ChatHistoryService import ChatHistoryService
from Backend.Source.Models.ChatModels import Conversation, Message


class TestChatHistoryService:
    """Tests for ChatHistoryService class."""

    @pytest.fixture
    def service(self):
        """Create service instance with mocked dependencies."""
        with patch("Backend.Source.Services.ChatHistoryService.get_kb_service") as mock_kb:
            mock_kb.return_value = Mock()
            service = ChatHistoryService()
            return service

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        db = Mock()
        return db

    # ============ create_conversation tests ============

    def test_create_conversation_success(self, service, mock_db):
        """Test successful conversation creation."""
        with patch.object(service, "get_db", return_value=mock_db):
            # Setup mock
            mock_conversation = Mock()
            mock_conversation.id = 1
            mock_conversation.title = "Test Chat"
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock(side_effect=lambda c: setattr(c, 'id', 1))

            # Execute
            result = service.create_conversation(user_id=1, title="Test Chat")

            # Verify
            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()
            assert mock_db.close.called

    def test_create_conversation_with_default_title(self, service, mock_db):
        """Test conversation creation with default title."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            service.create_conversation(user_id=1)

            # Verify the conversation was added with default title
            call_args = mock_db.add.call_args
            conversation = call_args[0][0]
            assert conversation.title == "New Chat"

    def test_create_conversation_rollback_on_error(self, service, mock_db):
        """Test that transaction is rolled back on error."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.add = Mock()
            mock_db.commit = Mock(side_effect=Exception("DB Error"))
            mock_db.rollback = Mock()

            with pytest.raises(Exception):
                service.create_conversation(user_id=1, title="Test")

            mock_db.rollback.assert_called_once()
            mock_db.close.assert_called_once()

    # ============ get_conversation_history tests ============

    def test_get_conversation_history_success(self, service, mock_db):
        """Test successful history retrieval with pagination."""
        with patch.object(service, "get_db", return_value=mock_db):
            # Setup mocks
            mock_conversation = Mock(id=1, user_id=1)
            mock_messages = [Mock(id=i, role="user", content=f"msg{i}") for i in range(3)]

            mock_db.query.return_value.filter.return_value.first.return_value = mock_conversation
            mock_db.query.return_value.filter.return_value.scalar.return_value = 10  # total count
            mock_db.query.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_messages

            # Execute
            result = service.get_conversation_history(
                conversation_id=1,
                user_id=1,
                skip=0,
                limit=3
            )

            # Verify
            assert result is not None
            messages, total = result
            assert len(messages) == 3
            assert total == 10

    def test_get_conversation_history_not_found(self, service, mock_db):
        """Test history retrieval when conversation not found."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.query.return_value.filter.return_value.first.return_value = None

            result = service.get_conversation_history(
                conversation_id=999,
                user_id=1
            )

            assert result is None

    def test_get_conversation_history_unauthorized(self, service, mock_db):
        """Test history retrieval with wrong user."""
        with patch.object(service, "get_db", return_value=mock_db):
            # User 2 trying to access user 1's conversation
            mock_db.query.return_value.filter.return_value.first.return_value = None

            result = service.get_conversation_history(
                conversation_id=1,
                user_id=2  # Different user
            )

            assert result is None

    # ============ get_recent_messages tests ============

    def test_get_recent_messages_success(self, service, mock_db):
        """Test getting recent messages for context."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_conversation = Mock(id=1, user_id=1)
            # Messages returned in DESC order (most recent first)
            mock_messages = [Mock(id=i, content=f"msg{i}") for i in range(5, 0, -1)]

            mock_db.query.return_value.filter.return_value.first.return_value = mock_conversation
            mock_db.query.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = mock_messages

            result = service.get_recent_messages(
                conversation_id=1,
                user_id=1,
                limit=5
            )

            # Should be reversed to chronological order
            assert result is not None
            assert len(result) == 5
            # First message should be id=1 (oldest of the recent ones)
            assert result[0].id == 1

    def test_get_recent_messages_not_found(self, service, mock_db):
        """Test recent messages when conversation not found."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.query.return_value.filter.return_value.first.return_value = None

            result = service.get_recent_messages(
                conversation_id=999,
                user_id=1
            )

            assert result is None

    # ============ add_message tests ============

    def test_add_message_success(self, service, mock_db):
        """Test successful message addition."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            result = service.add_message(
                conversation_id=1,
                role="user",
                content="Hello, world!"
            )

            mock_db.add.assert_called_once()
            mock_db.commit.assert_called_once()

    def test_add_message_with_attachment(self, service, mock_db):
        """Test message addition with attachment."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            service.add_message(
                conversation_id=1,
                role="user",
                content="Check this file",
                attachment_name="document.pdf",
                attachment_content="Base64 content..."
            )

            # Verify attachment info was included
            call_args = mock_db.add.call_args
            message = call_args[0][0]
            assert message.attachment_name == "document.pdf"

    def test_add_message_rollback_on_error(self, service, mock_db):
        """Test rollback when message addition fails."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.add = Mock()
            mock_db.commit = Mock(side_effect=Exception("DB Error"))
            mock_db.rollback = Mock()

            with pytest.raises(Exception):
                service.add_message(
                    conversation_id=1,
                    role="user",
                    content="Test"
                )

            mock_db.rollback.assert_called_once()

    # ============ delete_conversation tests ============

    def test_delete_conversation_success(self, service, mock_db):
        """Test successful conversation deletion."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_conversation = Mock(id=1, user_id=1)
            mock_db.query.return_value.filter.return_value.first.return_value = mock_conversation
            mock_db.delete = Mock()
            mock_db.commit = Mock()
            service.kb_service.delete_session_data = Mock()

            result = service.delete_conversation(conversation_id=1, user_id=1)

            assert result is True
            mock_db.delete.assert_called_once_with(mock_conversation)
            service.kb_service.delete_session_data.assert_called_once_with(1)

    def test_delete_conversation_not_found(self, service, mock_db):
        """Test deletion when conversation not found."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.query.return_value.filter.return_value.first.return_value = None

            result = service.delete_conversation(conversation_id=999, user_id=1)

            assert result is False

    def test_delete_conversation_unauthorized(self, service, mock_db):
        """Test deletion with wrong user."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_db.query.return_value.filter.return_value.first.return_value = None

            result = service.delete_conversation(conversation_id=1, user_id=999)

            assert result is False

    # ============ get_user_conversations tests ============

    def test_get_user_conversations_no_search(self, service, mock_db):
        """Test getting all conversations without search query."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_conversations = [
                Mock(id=1, title="Chat 1"),
                Mock(id=2, title="Chat 2")
            ]
            mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = mock_conversations

            result = service.get_user_conversations(user_id=1)

            assert len(result) == 2
            mock_db.close.assert_called_once()

    def test_get_user_conversations_search_by_title(self, service, mock_db):
        """Test searching conversations by title."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_conversation = Mock(id=1, title="Important Meeting")
            
            # Setup the chain of calls for search query
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.outerjoin.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.order_by.return_value.all.return_value = [mock_conversation]

            result = service.get_user_conversations(user_id=1, search_query="Important")

            assert len(result) == 1
            assert result[0].title == "Important Meeting"
            # Verify outerjoin was called (indicates search path was taken)
            mock_query.outerjoin.assert_called()

    def test_get_user_conversations_search_by_content(self, service, mock_db):
        """Test searching conversations by message content."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_conversation = Mock(id=2, title="New Chat")
            
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.outerjoin.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.order_by.return_value.all.return_value = [mock_conversation]

            result = service.get_user_conversations(user_id=1, search_query="DGA 5.2.1")

            assert len(result) == 1
            mock_query.outerjoin.assert_called()  # Message table was joined

    def test_get_user_conversations_search_no_match(self, service, mock_db):
        """Test search with no matching results."""
        with patch.object(service, "get_db", return_value=mock_db):
            mock_query = MagicMock()
            mock_db.query.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.outerjoin.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.order_by.return_value.all.return_value = []

            result = service.get_user_conversations(user_id=1, search_query="nonexistent")

            assert len(result) == 0
