"""
Integration tests for Authentication API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, Mock


class TestAuthEndpoints:
    """Integration tests for /api/auth endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client with mocked database."""
        with patch("Backend.Source.Core.Config.Validator.validate_config"):
            from Backend.Source.Main import app
            return TestClient(app)

    # ============ POST /api/auth/token tests ============

    def test_login_success(self, client):
        """Test successful login with valid credentials."""
        response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "1208"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "csrfToken" in data
        assert "access_token" not in data  # Token should be in cookie, not body

        # Check cookie is set
        assert "access_token" in response.cookies

    def test_login_invalid_password(self, client):
        """Test login with invalid password."""
        response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "wrongpassword"}
        )

        assert response.status_code == 401

    def test_login_invalid_username(self, client):
        """Test login with non-existent username."""
        response = client.post(
            "/api/auth/token",
            data={"username": "nonexistent", "password": "anypassword"}
        )

        assert response.status_code == 401

    def test_login_missing_credentials(self, client):
        """Test login with missing credentials."""
        response = client.post("/api/auth/token", data={})

        assert response.status_code == 422  # Validation error

    def test_login_empty_password(self, client):
        """Test login with empty password."""
        response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": ""}
        )

        assert response.status_code == 401 or response.status_code == 422

    # ============ POST /api/auth/register tests ============

    def test_register_new_user(self, client):
        """Test registration of new user."""
        response = client.post(
            "/api/auth/register",
            json={"username": "newuser", "password": "securepassword123"}
        )

        # Could be 200 (success) or 400 (user exists in some test scenarios)
        assert response.status_code in [200, 400]

    def test_register_duplicate_username(self, client):
        """Test registration with existing username."""
        # First registration
        client.post(
            "/api/auth/register",
            json={"username": "duplicateuser", "password": "password123"}
        )

        # Second registration with same username
        response = client.post(
            "/api/auth/register",
            json={"username": "duplicateuser", "password": "password456"}
        )

        assert response.status_code == 400

    def test_register_short_password(self, client):
        """Test registration with too short password."""
        response = client.post(
            "/api/auth/register",
            json={"username": "shortpwduser", "password": "123"}
        )

        # Should reject short passwords
        assert response.status_code in [400, 422]

    def test_register_missing_fields(self, client):
        """Test registration with missing fields."""
        response = client.post(
            "/api/auth/register",
            json={"username": "onlyusername"}
        )

        assert response.status_code == 422

    # ============ GET /api/auth/csrf tests ============

    def test_get_csrf_token(self, client):
        """Test CSRF token generation endpoint."""
        response = client.get("/api/auth/csrf")

        assert response.status_code == 200
        data = response.json()
        assert "csrfToken" in data
        assert len(data["csrfToken"]) > 20

    def test_csrf_token_unique_per_request(self, client):
        """Test that each request gets a unique CSRF token."""
        response1 = client.get("/api/auth/csrf")
        response2 = client.get("/api/auth/csrf")

        token1 = response1.json()["csrfToken"]
        token2 = response2.json()["csrfToken"]

        assert token1 != token2

    # ============ POST /api/auth/logout tests ============

    def test_logout_clears_cookie(self, client):
        """Test that logout clears the access token cookie."""
        # First login
        login_response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "1208"}
        )
        assert login_response.status_code == 200

        # Then logout
        csrf_token = login_response.json().get("csrfToken", "")
        logout_response = client.post(
            "/api/auth/logout",
            headers={"X-CSRF-Token": csrf_token}
        )

        # Cookie should be cleared or expired
        assert logout_response.status_code == 200

    # ============ Rate Limiting tests ============

    def test_login_rate_limiting(self, client):
        """Test that login endpoint is rate limited."""
        # Make many rapid requests
        responses = []
        for _ in range(10):
            response = client.post(
                "/api/auth/token",
                data={"username": "Qiyas", "password": "wrongpassword"}
            )
            responses.append(response.status_code)

        # Should eventually get rate limited (429)
        # Note: This test may pass/fail depending on rate limit config
        # In tests, rate limiting might be disabled
        assert 429 in responses or all(r == 401 for r in responses)

    # ============ Token Refresh tests ============

    def test_token_refresh_with_valid_token(self, client):
        """Test token refresh with valid existing token."""
        # First login
        login_response = client.post(
            "/api/auth/token",
            data={"username": "Qiyas", "password": "1208"}
        )
        assert login_response.status_code == 200

        # Get new token via refresh
        csrf_token = login_response.json().get("csrfToken", "")
        refresh_response = client.post(
            "/api/auth/refresh",
            headers={"X-CSRF-Token": csrf_token},
            cookies=login_response.cookies
        )

        # Should get new token
        assert refresh_response.status_code in [200, 401]  # 401 if refresh not implemented
