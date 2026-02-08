from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Request
from pathlib import Path
import os
from Backend.Source.Services.IngestionService import ingestion_service
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import FileProcessingError, ValidationError
from Backend.Source.Utils.FileValidator import FileValidator
from Backend.Source.Api.Routes.Auth import get_current_user
from Backend.Source.Models.User import User
from Backend.Source.Middleware.RateLimiting import limiter
from Backend.Source.Utils.CSRF import verify_csrf

router = APIRouter()

# Normalize path for cross-platform compatibility (Docker/Linux)
chroma_path_str = settings.CHROMA_DB_PATH.replace("\\", "/")
RAW_DATA_PATH = Path(chroma_path_str).parent / "Raw"

if not RAW_DATA_PATH.exists():
    RAW_DATA_PATH.mkdir(parents=True, exist_ok=True)


@router.get("/controls")
async def list_controls(current_user: User = Depends(get_current_user)):
    """
    List all available control documents in the Raw directory.
    Requires authentication.
    """
    files = []
    if RAW_DATA_PATH.exists():
        files = [f.name for f in RAW_DATA_PATH.iterdir() if f.is_file() and not f.name.startswith("~")]

    logger.info(f"Listed {len(files)} control documents", extra={"user_id": current_user.id})
    return {"files": files}


@router.post("/controls/upload")
@limiter.limit(settings.RATE_LIMIT_UPLOAD)
async def upload_control(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf)
):
    """
    Upload a new control document and ingest it.
    Requires authentication. Rate limited.
    """
    try:
        # Read file content
        file_content = await file.read()

        # Validate file (size, type, sanitize name)
        safe_filename, file_size = await FileValidator.validate_upload(
            file_content,
            file.filename,
            max_size=settings.MAX_FILE_SIZE_GENERAL
        )

        # Construct safe path
        file_path = RAW_DATA_PATH / safe_filename

        # Check if file already exists
        if file_path.exists():
            logger.warning(f"Attempted to upload duplicate file: {safe_filename}", extra={"user_id": current_user.id})
            raise ValidationError(f"File {safe_filename} already exists")

        # Save to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        logger.info(f"File uploaded: {safe_filename} ({file_size} bytes)", extra={"user_id": current_user.id})

        # Ingest
        success, msg = await ingestion_service.ingest_file(file_path)

        if not success:
            # Cleanup if failed
            os.remove(file_path)
            logger.error(f"Ingestion failed for {safe_filename}: {msg}", extra={"user_id": current_user.id})
            raise FileProcessingError(f"Ingestion failed: {msg}")

        logger.info(f"File ingested successfully: {safe_filename}", extra={"user_id": current_user.id})
        return {"status": "success", "message": f"Uploaded and ingested {safe_filename}"}

    except (ValidationError, FileProcessingError):
        raise
    except Exception as e:
        logger.exception(f"Upload failed: {str(e)}", extra={"user_id": current_user.id})
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/controls/{filename}")
async def delete_control(
    filename: str,
    current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf)
):
    """
    Delete a control document from Disk and Knowledge Base.
    Requires authentication.
    """
    # Sanitize filename to prevent path traversal
    safe_filename = FileValidator.sanitize_filename(filename)
    file_path = RAW_DATA_PATH / safe_filename

    # 1. Remove from DB
    ingestion_service.delete_document(safe_filename)

    # 2. Remove from Disk
    if file_path.exists():
        os.remove(file_path)
        logger.info(f"Deleted control document: {safe_filename}", extra={"user_id": current_user.id})
        return {"status": "success", "message": f"Deleted {safe_filename}"}
    else:
        logger.warning(f"Attempted to delete non-existent file: {safe_filename}", extra={"user_id": current_user.id})
        return {"status": "success", "message": "File removed (was not found on disk)"}
