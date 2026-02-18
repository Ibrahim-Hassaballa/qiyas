from fastapi import APIRouter, HTTPException, Depends
from Backend.Source.Services.SettingsService import settings_service, SettingsModel
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Core.Dependencies import require_role
from Backend.Source.Models.User import User
from Backend.Source.Utils.CSRF import verify_csrf
from Backend.Source.Core.Logging import logger

router = APIRouter()

# Maximum allowed length for system prompt
MAX_SYSTEM_PROMPT_LENGTH = 10000

# Forbidden patterns in system prompt (basic injection prevention)
FORBIDDEN_PATTERNS = [
    "ignore previous instructions",
    "ignore all instructions",
    "disregard your instructions",
]


def validate_system_prompt(prompt: str) -> str:
    """Validate system prompt for security and constraints."""
    if not prompt:
        raise HTTPException(status_code=400, detail="System prompt cannot be empty")

    if len(prompt) > MAX_SYSTEM_PROMPT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"System prompt too long. Maximum {MAX_SYSTEM_PROMPT_LENGTH} characters allowed."
        )

    # Check for forbidden patterns (case-insensitive)
    prompt_lower = prompt.lower()
    for pattern in FORBIDDEN_PATTERNS:
        if pattern in prompt_lower:
            logger.warning(f"Forbidden pattern detected in system prompt: {pattern}")
            raise HTTPException(
                status_code=400,
                detail="System prompt contains forbidden content"
            )

    return prompt


@router.get("/settings", response_model=SettingsModel)
async def get_settings(current_user: User = Depends(get_current_user)):
    """
    Get settings for the current tenant.
    """
    return settings_service.get_settings(str(current_user.tenant_id))


VALID_MODEL_PROVIDERS = {"azure", "groq"}


@router.post("/settings", response_model=SettingsModel)
async def update_settings(
    settings_data: SettingsModel,
    current_user: User = Depends(require_role("admin", "owner")),
    _csrf: None = Depends(verify_csrf)
):
    """
    Update application settings.
    Requires admin/owner role and CSRF verification.
    """
    try:
        # Validate model_provider
        if settings_data.model_provider not in VALID_MODEL_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model_provider. Must be one of: {', '.join(VALID_MODEL_PROVIDERS)}"
            )

        # Validate system prompt
        validated_prompt = validate_system_prompt(settings_data.system_prompt)
        settings_data.system_prompt = validated_prompt

        # Validate topic guard prompt
        if settings_data.topic_guard_prompt:
            validate_system_prompt(settings_data.topic_guard_prompt)

        settings_service.save_settings(settings_data, tenant_id=str(current_user.tenant_id))
        logger.info(f"Settings updated by user {current_user.username}")
        return settings_data
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update settings")
