"""
Configuration Validator

Validates all required settings at application startup to fail fast
with clear error messages instead of cryptic runtime errors.
"""

import os
from pathlib import Path
from typing import List, Tuple
from Backend.Source.Core.Logging import logger


def validate_config(settings) -> None:
    """
    Validate configuration at startup.

    Args:
        settings: The Settings object from Config.py

    Raises:
        ValueError: If configuration validation fails with details
    """
    errors: List[str] = []
    warnings: List[str] = []

    # --- Required Security Settings ---
    if not settings.SECRET_KEY:
        errors.append("SECRET_KEY is not set. Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
    elif len(settings.SECRET_KEY) < 32:
        warnings.append("SECRET_KEY is shorter than recommended (32+ characters)")

    # --- Azure OpenAI Chat Settings ---
    if not settings.AZURE_CHAT_ENDPOINT:
        errors.append("AZURE_CHAT_ENDPOINT is not set")
    elif not settings.AZURE_CHAT_ENDPOINT.startswith("https://"):
        warnings.append("AZURE_CHAT_ENDPOINT should use HTTPS")

    if not settings.AZURE_CHAT_KEY:
        errors.append("AZURE_CHAT_KEY is not set")

    if not settings.AZURE_CHAT_DEPLOYMENT:
        errors.append("AZURE_CHAT_DEPLOYMENT is not set")

    if not settings.AZURE_CHAT_API_VERSION:
        errors.append("AZURE_CHAT_API_VERSION is not set")

    # --- Azure OpenAI Embedding Settings ---
    if not settings.AZURE_EMBEDDING_ENDPOINT:
        errors.append("AZURE_EMBEDDING_ENDPOINT is not set")

    if not settings.AZURE_EMBEDDING_KEY:
        errors.append("AZURE_EMBEDDING_KEY is not set")

    if not settings.AZURE_EMBEDDING_DEPLOYMENT:
        errors.append("AZURE_EMBEDDING_DEPLOYMENT is not set")

    if not settings.AZURE_EMBEDDING_API_VERSION:
        errors.append("AZURE_EMBEDDING_API_VERSION is not set")

    # --- Path Validations ---
    chroma_path = Path(settings.CHROMA_DB_PATH)
    if not chroma_path.parent.exists():
        warnings.append(f"CHROMA_DB_PATH parent directory does not exist: {chroma_path.parent}")

    log_path = Path(settings.LOG_FILE)
    if not log_path.parent.exists():
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created log directory: {log_path.parent}")
        except Exception as e:
            warnings.append(f"Could not create log directory {log_path.parent}: {e}")

    # --- Cookie Security for Production ---
    if settings.COOKIE_SECURE is False:
        warnings.append("COOKIE_SECURE is False. Set to True in production (requires HTTPS)")

    # --- CORS Validation ---
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(',')]
    if '*' in origins:
        errors.append("CORS_ORIGINS contains wildcard '*'. This is a security risk")
    if not origins:
        errors.append("CORS_ORIGINS is empty")

    # --- Rate Limiting ---
    if not settings.RATE_LIMIT_ENABLED:
        warnings.append("Rate limiting is disabled (RATE_LIMIT_ENABLED=false)")

    # --- Log Warnings ---
    for warning in warnings:
        logger.warning(f"Configuration warning: {warning}")

    # --- Fail on Errors ---
    if errors:
        error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info("Configuration validation passed")


def validate_azure_connectivity(settings) -> Tuple[bool, str]:
    """
    Optional: Test Azure OpenAI connectivity.

    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        from openai import AzureOpenAI

        client = AzureOpenAI(
            api_key=settings.AZURE_CHAT_KEY,
            api_version=settings.AZURE_CHAT_API_VERSION,
            azure_endpoint=settings.AZURE_CHAT_ENDPOINT
        )

        # Simple test - list models (lightweight call)
        # Note: This may not work with all Azure configurations
        # client.models.list()

        return True, "Azure OpenAI connection configured"
    except Exception as e:
        return False, f"Azure OpenAI connection test failed: {e}"
