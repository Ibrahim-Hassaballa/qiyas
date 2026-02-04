from typing import Any, Optional


class QiyasAIException(Exception):
    """Base exception for QiyasAI"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Any] = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class AuthenticationError(QiyasAIException):
    """Authentication failed"""
    def __init__(self, message: str = "Authentication failed", details: Optional[Any] = None):
        super().__init__(message, status_code=401, details=details)


class AuthorizationError(QiyasAIException):
    """User not authorized for this action"""
    def __init__(self, message: str = "Access denied", details: Optional[Any] = None):
        super().__init__(message, status_code=403, details=details)


class ValidationError(QiyasAIException):
    """Input validation failed"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, status_code=400, details=details)


class FileProcessingError(QiyasAIException):
    """File processing failed"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, status_code=422, details=details)


class RateLimitExceeded(QiyasAIException):
    """Rate limit exceeded"""
    def __init__(self, message: str = "Too many requests", details: Optional[Any] = None):
        super().__init__(message, status_code=429, details=details)


class ResourceNotFoundError(QiyasAIException):
    """Requested resource not found"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, status_code=404, details=details)
