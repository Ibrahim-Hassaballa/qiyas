from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from pathlib import Path
import os
from Backend.Source.Services.IngestionService import ingestion_service
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import FileProcessingError, ValidationError
from Backend.Source.Utils.FileValidator import FileValidator
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Core.Dependencies import require_role
from Backend.Source.Models.User import User
from Backend.Source.Middleware.RateLimiting import limiter
from Backend.Source.Utils.CSRF import verify_csrf

router = APIRouter()


# Default shared knowledge base path
_DEFAULT_RAW_PATH = Path("Data/Raw")


def _get_tenant_data_path(tenant_id) -> Path:
    """Get the tenant-scoped raw data directory. Creates it if it doesn't exist."""
    path = Path(f"Data/Tenants/{str(tenant_id)}/Raw")
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.get("/controls")
async def list_controls(current_user: User = Depends(get_current_user)):
    """
    List all control documents: default (shared) + tenant-specific.
    """
    files = []

    # 1. Default/shared knowledge base files (from Data/Raw)
    if _DEFAULT_RAW_PATH.exists():
        for f in _DEFAULT_RAW_PATH.iterdir():
            if f.is_file() and not f.name.startswith("~"):
                files.append({"name": f.name, "is_default": True})

    # 2. Tenant-specific files
    tenant_path = _get_tenant_data_path(current_user.tenant_id)
    if tenant_path.exists():
        for f in tenant_path.iterdir():
            if f.is_file() and not f.name.startswith("~"):
                files.append({"name": f.name, "is_default": False})

    logger.info(f"Listed {len(files)} control documents", extra={"user_id": str(current_user.id), "tenant_id": str(current_user.tenant_id)})
    return {"files": files}


@router.post("/controls/upload")
@limiter.limit(settings.RATE_LIMIT_UPLOAD)
async def upload_control(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("admin", "owner")),
    _csrf: None = Depends(verify_csrf)
):
    """
    Upload a control document to the tenant's data directory and ingest it.
    Requires admin/owner role.
    """
    tenant_id_str = str(current_user.tenant_id)
    tenant_path = _get_tenant_data_path(current_user.tenant_id)
    
    try:
        file_content = await file.read()

        safe_filename, file_size = await FileValidator.validate_upload(
            file_content,
            file.filename,
            max_size=settings.MAX_FILE_SIZE_GENERAL
        )

        file_path = tenant_path / safe_filename

        if file_path.exists():
            logger.warning(f"Attempted to upload duplicate file: {safe_filename}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
            raise ValidationError(f"File {safe_filename} already exists")

        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        logger.info(f"File uploaded: {safe_filename} ({file_size} bytes)", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})

        # Ingest into tenant-scoped collection
        success, msg = await ingestion_service.ingest_file(file_path, tenant_id=tenant_id_str)

        if not success:
            os.remove(file_path)
            logger.error(f"Ingestion failed for {safe_filename}: {msg}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
            raise FileProcessingError(f"Ingestion failed: {msg}")

        logger.info(f"File ingested successfully: {safe_filename}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
        return {"status": "success", "message": f"Uploaded and ingested {safe_filename}"}

    except (ValidationError, FileProcessingError):
        raise
    except Exception as e:
        logger.exception(f"Upload failed: {str(e)}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/controls/{filename}")
async def delete_control(
    filename: str,
    current_user: User = Depends(require_role("admin", "owner")),
    _csrf: None = Depends(verify_csrf)
):
    """
    Delete a control document from the tenant's directory and knowledge base.
    Requires admin/owner role.
    """
    tenant_id_str = str(current_user.tenant_id)
    tenant_path = _get_tenant_data_path(current_user.tenant_id)
    
    safe_filename = FileValidator.sanitize_filename(filename)
    file_path = tenant_path / safe_filename

    # Remove from tenant's KB collection
    ingestion_service.delete_document(safe_filename, tenant_id=tenant_id_str)

    # Remove from disk
    if file_path.exists():
        os.remove(file_path)
        logger.info(f"Deleted control document: {safe_filename}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
        return {"status": "success", "message": f"Deleted {safe_filename}"}
    else:
        logger.warning(f"Attempted to delete non-existent file: {safe_filename}", extra={"user_id": str(current_user.id), "tenant_id": tenant_id_str})
        return {"status": "success", "message": "File removed (was not found on disk)"}
