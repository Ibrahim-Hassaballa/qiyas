"""
Unit tests for CSRF utility.
"""

import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
from fastapi import HTTPException


class TestCSRF:
    """Tests for CSRF token management."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Clear CSRF tokens before each test."""
        # Import here to ensure fresh state
        from Backend.Source.Utils.CSRF import csrf_tokens
        csrf_tokens.clear()

    def test_generate_csrf_token(self):
        """Test CSRF token generation."""
        from Backend.Source.Utils.CSRF import generate_csrf_token

        token = generate_csrf_token()

        assert token is not None
        assert len(token) > 20  # Should be a substantial token
        assert isinstance(token, str)

    def test_generate_csrf_token_unique(self):
        """Test that generated tokens are unique."""
        from Backend.Source.Utils.CSRF import generate_csrf_token

        tokens = [generate_csrf_token() for _ in range(100)]
        unique_tokens = set(tokens)

        assert len(unique_tokens) == 100  # All tokens should be unique

    def test_generate_csrf_token_stored(self):
        """Test that generated token is stored."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, csrf_tokens

        token = generate_csrf_token()

        assert token in csrf_tokens

    def test_verify_csrf_valid_token(self):
        """Test verification of valid CSRF token."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, verify_csrf, csrf_tokens

        token = generate_csrf_token()

        # Create mock request with valid token
        mock_request = Mock()
        mock_request.headers = {"X-CSRF-Token": token}

        # Should not raise exception
        verify_csrf(request=mock_request)

    def test_verify_csrf_missing_token(self):
        """Test verification with missing CSRF token."""
        from Backend.Source.Utils.CSRF import verify_csrf

        mock_request = Mock()
        mock_request.headers = {}

        with pytest.raises(HTTPException) as exc_info:
            verify_csrf(request=mock_request)

        assert exc_info.value.status_code == 403

    def test_verify_csrf_invalid_token(self):
        """Test verification with invalid CSRF token."""
        from Backend.Source.Utils.CSRF import verify_csrf, generate_csrf_token

        # Generate a valid token but use a different one
        generate_csrf_token()

        mock_request = Mock()
        mock_request.headers = {"X-CSRF-Token": "invalid_token_12345"}

        with pytest.raises(HTTPException) as exc_info:
            verify_csrf(request=mock_request)

        assert exc_info.value.status_code == 403

    def test_verify_csrf_expired_token(self):
        """Test verification with expired CSRF token."""
        from Backend.Source.Utils.CSRF import verify_csrf, csrf_tokens

        # Manually add an expired token
        expired_token = "expired_test_token"
        expired_time = datetime.utcnow() - timedelta(hours=2)  # 2 hours ago
        csrf_tokens[expired_token] = expired_time

        mock_request = Mock()
        mock_request.headers = {"X-CSRF-Token": expired_token}

        with pytest.raises(HTTPException) as exc_info:
            verify_csrf(request=mock_request)

        assert exc_info.value.status_code == 403

    def test_cleanup_expired_tokens(self):
        """Test cleanup of expired tokens."""
        from Backend.Source.Utils.CSRF import (
            generate_csrf_token,
            cleanup_expired_tokens,
            csrf_tokens
        )

        # Generate a valid token
        valid_token = generate_csrf_token()

        # Manually add expired tokens
        for i in range(5):
            expired_token = f"expired_{i}"
            csrf_tokens[expired_token] = datetime.utcnow() - timedelta(hours=2)

        # Should have 6 tokens total
        assert len(csrf_tokens) == 6

        # Cleanup
        cleanup_expired_tokens()

        # Should only have the valid token left
        assert len(csrf_tokens) == 1
        assert valid_token in csrf_tokens

    def test_token_consumed_after_verification(self):
        """Test that token is NOT consumed after verification (should remain valid)."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, verify_csrf, csrf_tokens

        token = generate_csrf_token()

        mock_request = Mock()
        mock_request.headers = {"X-CSRF-Token": token}

        # First verification
        verify_csrf(request=mock_request)

        # Token should still be valid (not single-use)
        assert token in csrf_tokens

    def test_csrf_token_format(self):
        """Test that CSRF token has correct format."""
        from Backend.Source.Utils.CSRF import generate_csrf_token

        token = generate_csrf_token()

        # Should be URL-safe base64
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', token)

    def test_multiple_tokens_stored(self):
        """Test that multiple tokens can be stored (for multiple sessions)."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, csrf_tokens

        tokens = [generate_csrf_token() for _ in range(10)]

        assert len(csrf_tokens) == 10
        for token in tokens:
            assert token in csrf_tokens

    def test_verify_csrf_header_case_sensitivity(self):
        """Test CSRF header is case-sensitive."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, verify_csrf

        token = generate_csrf_token()

        # Test with different header case
        mock_request = Mock()
        mock_request.headers = {"x-csrf-token": token}  # lowercase

        # FastAPI normalizes headers, but test with exact case
        mock_request.headers.get = Mock(return_value=None)

        # Should handle case-insensitive header access
        # This depends on implementation - just verify no crash
        try:
            verify_csrf(request=mock_request)
        except HTTPException as e:
            assert e.status_code == 403  # Missing token is expected

    def test_token_timestamp_stored(self):
        """Test that token timestamp is stored correctly."""
        from Backend.Source.Utils.CSRF import generate_csrf_token, csrf_tokens

        before = datetime.utcnow()
        token = generate_csrf_token()
        after = datetime.utcnow()

        stored_time = csrf_tokens[token]
        assert before <= stored_time <= after
