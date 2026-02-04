import magic
import os
from pathlib import Path
from typing import Tuple
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Exceptions import ValidationError
from Backend.Source.Core.Logging import logger


class FileValidator:
    """Validates uploaded files for security and compliance"""

    # MIME type whitelist (actual file content validation)
    ALLOWED_MIME_TYPES = {
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # .docx
        'application/msword',  # .doc
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
        'application/vnd.ms-excel',  # .xls
        'text/plain',
        'image/png',
        'image/jpeg',
    }

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """
        Sanitize filename to prevent path traversal attacks

        Args:
            filename: Original filename from upload

        Returns:
            Sanitized filename (only basename, no path components)
        """
        # Get only the filename, removing any path components
        safe_name = os.path.basename(filename)

        # Remove any remaining path traversal attempts
        safe_name = safe_name.replace("..", "").replace("/", "").replace("\\", "")

        # Remove null bytes
        safe_name = safe_name.replace("\x00", "")

        if not safe_name:
            raise ValidationError("Invalid filename")

        logger.debug(f"Sanitized filename: {filename} -> {safe_name}")
        return safe_name

    @staticmethod
    def validate_file_extension(filename: str) -> bool:
        """
        Validate file extension against whitelist

        Args:
            filename: Name of the file

        Returns:
            True if extension is allowed

        Raises:
            ValidationError: If extension not allowed
        """
        file_ext = Path(filename).suffix.lower()

        if file_ext not in settings.allowed_extensions_list:
            logger.warning(f"Rejected file with invalid extension: {file_ext}")
            raise ValidationError(
                f"File type not allowed. Allowed types: {settings.ALLOWED_FILE_EXTENSIONS}",
                details={"filename": filename, "extension": file_ext}
            )

        return True

    @staticmethod
    def validate_file_size(file_size: int, max_size: int) -> bool:
        """
        Validate file size against limit

        Args:
            file_size: Size of file in bytes
            max_size: Maximum allowed size in bytes

        Returns:
            True if size is acceptable

        Raises:
            ValidationError: If file too large
        """
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            actual_mb = file_size / (1024 * 1024)
            logger.warning(f"File too large: {actual_mb:.2f}MB (max: {max_mb:.2f}MB)")
            raise ValidationError(
                f"File too large. Maximum size: {max_mb:.0f}MB",
                details={"file_size_mb": actual_mb, "max_size_mb": max_mb}
            )

        return True

    @staticmethod
    async def validate_mime_type(file_content: bytes, filename: str) -> bool:
        """
        Validate file MIME type using magic numbers (content-based)

        Args:
            file_content: Binary content of the file
            filename: Name of the file (for logging)

        Returns:
            True if MIME type is allowed

        Raises:
            ValidationError: If MIME type not allowed
        """
        try:
            # Use python-magic to detect actual file type
            mime = magic.from_buffer(file_content, mime=True)

            if mime not in FileValidator.ALLOWED_MIME_TYPES:
                logger.warning(f"Rejected file with invalid MIME type: {mime} (filename: {filename})")
                raise ValidationError(
                    f"File type not allowed (detected: {mime})",
                    details={"filename": filename, "mime_type": mime}
                )

            logger.debug(f"MIME type validated: {mime} for {filename}")
            return True

        except Exception as e:
            logger.error(f"MIME type validation failed: {e}")
            raise ValidationError("Unable to validate file type", details={"filename": filename})

    @staticmethod
    async def validate_upload(
        file_content: bytes,
        filename: str,
        max_size: int = None
    ) -> Tuple[str, int]:
        """
        Complete file validation pipeline

        Args:
            file_content: Binary content of file
            filename: Original filename
            max_size: Maximum allowed size (defaults to general limit)

        Returns:
            Tuple of (sanitized_filename, file_size)

        Raises:
            ValidationError: If any validation fails
        """
        if max_size is None:
            max_size = settings.MAX_FILE_SIZE_GENERAL

        # 1. Sanitize filename
        safe_filename = FileValidator.sanitize_filename(filename)

        # 2. Check extension
        FileValidator.validate_file_extension(safe_filename)

        # 3. Check size
        file_size = len(file_content)
        FileValidator.validate_file_size(file_size, max_size)

        # 4. Check MIME type (magic numbers)
        await FileValidator.validate_mime_type(file_content, safe_filename)

        logger.info(f"File validation passed: {safe_filename} ({file_size} bytes)")
        return safe_filename, file_size
