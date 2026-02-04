import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Chat Settings
    AZURE_CHAT_ENDPOINT: str
    AZURE_CHAT_KEY: str
    AZURE_CHAT_DEPLOYMENT: str
    AZURE_CHAT_API_VERSION: str

    # Embedding Settings
    AZURE_EMBEDDING_ENDPOINT: str
    AZURE_EMBEDDING_KEY: str
    AZURE_EMBEDDING_DEPLOYMENT: str
    AZURE_EMBEDDING_API_VERSION: str

    # App Settings
    HOST: str
    PORT: int

    # Vector DB Path
    CHROMA_DB_PATH: str

    # Security Settings (REQUIRED - no defaults)
    SECRET_KEY: str  # Must be set in .env - no fallback!
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_CHAT: str = "20/minute"
    RATE_LIMIT_UPLOAD: str = "10/minute"

    # File Upload Limits (in bytes)
    MAX_FILE_SIZE_GENERAL: int = 52428800  # 50MB
    MAX_FILE_SIZE_CHAT: int = 26214400     # 25MB
    ALLOWED_FILE_EXTENSIONS: str = ".pdf,.docx,.doc,.xlsx,.xls,.txt,.png,.jpg,.jpeg"

    # Cookie Settings
    COOKIE_SECURE: bool = False  # Set True in production (requires HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None  # None = current domain

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"
    LOG_FILE: str = "logs/qiyasai.log"

    # CORS (comma-separated origins)
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        # Navigate up from Source/Core/Config/config.py to Backend/.env
        # Config -> Core -> Source -> Backend
        env_file=os.path.join(Path(__file__).resolve().parent.parent.parent.parent, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def allowed_extensions_list(self) -> list:
        """Parse comma-separated extensions into list"""
        return [ext.strip() for ext in self.ALLOWED_FILE_EXTENSIONS.split(',')]

settings = Settings()
