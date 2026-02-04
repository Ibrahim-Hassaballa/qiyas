"""
Pytest configuration and shared fixtures for QiyasAI tests.
"""

import pytest
import sys
import os
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Generator, Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Import after path setup
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient


# ============ Database Fixtures ============

@pytest.fixture(scope="function")
def test_db():
    """Create a fresh in-memory SQLite database for each test."""
    from Backend.Source.Core.Database import Base

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create all tables
    Base.metadata.create_all(bind=engine)

    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_user(test_db):
    """Create a test user."""
    from Backend.Source.Models.User import User
    from Backend.Source.Core.Security import get_password_hash

    user = User(
        username="testuser",
        hashed_password=get_password_hash("testpassword123")
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture(scope="function")
def test_conversation(test_db, test_user):
    """Create a test conversation."""
    from Backend.Source.Models.ChatModels import Conversation

    conversation = Conversation(
        user_id=test_user.id,
        title="Test Conversation"
    )
    test_db.add(conversation)
    test_db.commit()
    test_db.refresh(conversation)
    return conversation


@pytest.fixture(scope="function")
def test_messages(test_db, test_conversation):
    """Create test messages in a conversation."""
    from Backend.Source.Models.ChatModels import Message

    messages = []
    for i, (role, content) in enumerate([
        ("user", "Hello, what is DGA 5.2.1?"),
        ("assistant", "DGA 5.2.1 covers digital transformation governance..."),
        ("user", "Can you explain more?"),
        ("assistant", "Certainly! The standard requires...")
    ]):
        msg = Message(
            conversation_id=test_conversation.id,
            role=role,
            content=content
        )
        test_db.add(msg)
        messages.append(msg)

    test_db.commit()
    for msg in messages:
        test_db.refresh(msg)

    return messages


# ============ Mock Fixtures ============

@pytest.fixture
def mock_azure_openai():
    """Mock Azure OpenAI client."""
    with patch("Backend.Source.Services.AIService.AsyncAzureOpenAI") as mock_async, \
         patch("Backend.Source.Services.AIService.AzureOpenAI") as mock_sync:

        # Mock async chat completion
        mock_async_instance = AsyncMock()
        mock_async.return_value = mock_async_instance

        # Mock streaming response
        async def mock_stream():
            chunks = ["Hello", ", ", "this", " is", " a", " test", " response."]
            for chunk in chunks:
                mock_chunk = Mock()
                mock_chunk.choices = [Mock(delta=Mock(content=chunk))]
                yield mock_chunk

        mock_async_instance.chat.completions.create = AsyncMock(return_value=mock_stream())

        # Mock sync embeddings
        mock_sync_instance = Mock()
        mock_sync.return_value = mock_sync_instance

        mock_embedding_response = Mock()
        mock_embedding_response.data = [Mock(embedding=[0.1] * 1536)]
        mock_sync_instance.embeddings.create.return_value = mock_embedding_response

        yield {
            "async_client": mock_async_instance,
            "sync_client": mock_sync_instance
        }


@pytest.fixture
def mock_chromadb():
    """Mock ChromaDB client."""
    with patch("Backend.Source.Services.KnowledgeBaseService.chromadb") as mock_chroma:
        mock_client = Mock()
        mock_chroma.PersistentClient.return_value = mock_client

        # Mock collection
        mock_collection = Mock()
        mock_client.get_or_create_collection.return_value = mock_collection

        # Mock query results
        mock_collection.query.return_value = {
            "ids": [["doc1", "doc2"]],
            "documents": [["Document 1 content", "Document 2 content"]],
            "metadatas": [[{"source": "test1.pdf"}, {"source": "test2.pdf"}]],
            "distances": [[0.1, 0.2]]
        }

        yield mock_collection


# ============ API Client Fixtures ============

@pytest.fixture
def app():
    """Create FastAPI test application."""
    from Backend.Source.Main import app
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers(test_user):
    """Generate authentication headers for test user."""
    from Backend.Source.Core.Security import create_access_token

    token = create_access_token(data={"sub": test_user.username})
    return {"Authorization": f"Bearer {token}"}


# ============ Utility Fixtures ============

@pytest.fixture
def sample_document_text():
    """Sample Arabic document text for testing."""
    return """
    المملكة العربية السعودية
    هيئة الحكومة الرقمية

    معيار 5.2.1 - تأسيس لجنة للتحول الرقمي

    يجب على الجهة تأسيس لجنة توجيهية للتحول الرقمي تتولى المهام التالية:
    1. وضع الاستراتيجية الرقمية للجهة
    2. متابعة تنفيذ مبادرات التحول الرقمي
    3. اعتماد المشاريع الرقمية
    4. مراجعة مؤشرات الأداء الرقمي

    يجب أن تعقد اللجنة اجتماعات دورية لا تقل عن مرة كل شهر.
    """


@pytest.fixture
def sample_standards():
    """Sample DGA standards for testing."""
    return {
        "5.2.1": "Digital Transformation Committee",
        "5.2.2": "Digital Transformation Governance Framework",
        "5.8.1": "IT Risk Management",
        "5.9.1": "Business Continuity Planning"
    }
