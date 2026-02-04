"""
Integration tests for Chat History API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch


class TestHistoryEndpoints:
    """Integration tests for /api/history endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        with patch("Backend.Source.Core.Config.Validator.validate_config"):
            from Backend.Source.Main import app
            return TestClient(app)

    @pytest.fixture
    def auth_client(self, client):
        """Create authenticated client with CSRF token."""
        # Login first
        login_response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "1208"}
        )
        assert login_response.status_code == 200

        csrf_token = login_response.json().get("csrfToken", "")
        cookies = login_response.cookies

        return client, csrf_token, cookies

    # ============ GET /api/history tests ============

    def test_get_conversations_authenticated(self, auth_client):
        """Test getting conversation list when authenticated."""
        client, csrf_token, cookies = auth_client

        response = client.get(
            "/api/history/",
            cookies=cookies
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_conversations_unauthenticated(self, client):
        """Test getting conversations without authentication."""
        response = client.get("/api/history/")

        assert response.status_code == 401

    # ============ POST /api/history tests ============

    def test_create_conversation(self, auth_client):
        """Test creating a new conversation."""
        client, csrf_token, cookies = auth_client

        response = client.post(
            "/api/history/",
            json={"title": "Test Conversation"},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == "Test Conversation"

    def test_create_conversation_default_title(self, auth_client):
        """Test creating conversation with default title."""
        client, csrf_token, cookies = auth_client

        response = client.post(
            "/api/history/",
            json={},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )

        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "New Chat"

    def test_create_conversation_without_csrf(self, auth_client):
        """Test creating conversation without CSRF token."""
        client, csrf_token, cookies = auth_client

        response = client.post(
            "/api/history/",
            json={"title": "Test"},
            cookies=cookies
            # Missing CSRF header
        )

        assert response.status_code == 403

    def test_create_conversation_title_length_limit(self, auth_client):
        """Test creating conversation with very long title."""
        client, csrf_token, cookies = auth_client

        long_title = "A" * 1000  # Very long title

        response = client.post(
            "/api/history/",
            json={"title": long_title},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )

        # Should either truncate or reject
        assert response.status_code in [200, 422]
        if response.status_code == 200:
            data = response.json()
            assert len(data["title"]) <= 500  # Should be truncated

    # ============ GET /api/history/{id} tests ============

    def test_get_conversation_history(self, auth_client):
        """Test getting conversation history with pagination."""
        client, csrf_token, cookies = auth_client

        # First create a conversation
        create_response = client.post(
            "/api/history/",
            json={"title": "Test"},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )
        conv_id = create_response.json()["id"]

        # Get history
        response = client.get(
            f"/api/history/{conv_id}",
            cookies=cookies
        )

        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "has_more" in data

    def test_get_conversation_history_pagination(self, auth_client):
        """Test pagination parameters."""
        client, csrf_token, cookies = auth_client

        # Create a conversation
        create_response = client.post(
            "/api/history/",
            json={"title": "Test"},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )
        conv_id = create_response.json()["id"]

        # Get with pagination
        response = client.get(
            f"/api/history/{conv_id}?skip=0&limit=10",
            cookies=cookies
        )

        assert response.status_code == 200
        data = response.json()
        assert data["skip"] == 0
        assert data["limit"] == 10

    def test_get_conversation_history_invalid_id(self, auth_client):
        """Test getting history for non-existent conversation."""
        client, csrf_token, cookies = auth_client

        response = client.get(
            "/api/history/99999",
            cookies=cookies
        )

        assert response.status_code == 404

    def test_get_conversation_history_unauthenticated(self, client):
        """Test getting history without authentication."""
        response = client.get("/api/history/1")

        assert response.status_code == 401

    # ============ DELETE /api/history/{id} tests ============

    def test_delete_conversation(self, auth_client):
        """Test deleting a conversation."""
        client, csrf_token, cookies = auth_client

        # Create a conversation first
        create_response = client.post(
            "/api/history/",
            json={"title": "To Delete"},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )
        conv_id = create_response.json()["id"]

        # Delete it
        response = client.delete(
            f"/api/history/{conv_id}",
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )

        assert response.status_code == 200
        assert response.json()["status"] == "success"

        # Verify it's gone
        get_response = client.get(
            f"/api/history/{conv_id}",
            cookies=cookies
        )
        assert get_response.status_code == 404

    def test_delete_conversation_without_csrf(self, auth_client):
        """Test deleting without CSRF token."""
        client, csrf_token, cookies = auth_client

        # Create a conversation
        create_response = client.post(
            "/api/history/",
            json={"title": "Test"},
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )
        conv_id = create_response.json()["id"]

        # Try to delete without CSRF
        response = client.delete(
            f"/api/history/{conv_id}",
            cookies=cookies
        )

        assert response.status_code == 403

    def test_delete_nonexistent_conversation(self, auth_client):
        """Test deleting non-existent conversation."""
        client, csrf_token, cookies = auth_client

        response = client.delete(
            "/api/history/99999",
            headers={"X-CSRF-Token": csrf_token},
            cookies=cookies
        )

        assert response.status_code == 404

    # ============ Authorization tests ============

    def test_cannot_access_other_users_conversation(self, client):
        """Test that users cannot access other users' conversations."""
        # Login as first user
        login1 = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "1208"}
        )
        csrf1 = login1.json().get("csrfToken", "")
        cookies1 = login1.cookies

        # Create conversation as first user
        create_response = client.post(
            "/api/history/",
            json={"title": "Private Chat"},
            headers={"X-CSRF-Token": csrf1},
            cookies=cookies1
        )
        conv_id = create_response.json()["id"]

        # Try to register and login as second user
        client.post(
            "/api/auth/register",
            json={"username": "otheruser", "password": "password123"}
        )
        login2 = client.post(
            "/api/auth/token",
            data={"username": "otheruser", "password": "password123"}
        )

        if login2.status_code == 200:
            cookies2 = login2.cookies

            # Try to access first user's conversation
            response = client.get(
                f"/api/history/{conv_id}",
                cookies=cookies2
            )

            # Should be denied (404 to hide existence)
            assert response.status_code == 404
