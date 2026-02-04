"""
Unit tests for FileValidator utility.
"""

import pytest
from unittest.mock import patch, Mock
from Backend.Source.Utils.FileValidator import FileValidator
from Backend.Source.Core.Exceptions import ValidationError


class TestFileValidator:
    """Tests for FileValidator class."""

    # ============ sanitize_filename tests ============

    def test_sanitize_filename_normal(self):
        """Test sanitization of normal filename."""
        result = FileValidator.sanitize_filename("document.pdf")
        assert result == "document.pdf"

    def test_sanitize_filename_path_traversal(self):
        """Test removal of path traversal attempts."""
        result = FileValidator.sanitize_filename("../../../etc/passwd")
        assert ".." not in result
        assert "/" not in result

    def test_sanitize_filename_backslash_traversal(self):
        """Test removal of backslash path traversal."""
        result = FileValidator.sanitize_filename("..\\..\\windows\\system32")
        assert ".." not in result
        assert "\\" not in result

    def test_sanitize_filename_null_bytes(self):
        """Test removal of null bytes."""
        result = FileValidator.sanitize_filename("document\x00.pdf")
        assert "\x00" not in result

    def test_sanitize_filename_spaces(self):
        """Test handling of spaces in filename."""
        result = FileValidator.sanitize_filename("my document file.pdf")
        assert result == "my document file.pdf"

    def test_sanitize_filename_unicode(self):
        """Test handling of Unicode characters (Arabic)."""
        result = FileValidator.sanitize_filename("تقرير_2024.pdf")
        assert result == "تقرير_2024.pdf"

    def test_sanitize_filename_empty_raises(self):
        """Test handling of empty filename raises ValidationError."""
        with pytest.raises(ValidationError):
            FileValidator.sanitize_filename("")

    def test_sanitize_filename_only_traversal_raises(self):
        """Test handling of filename with only path traversal chars."""
        with pytest.raises(ValidationError):
            FileValidator.sanitize_filename("../../../")

    # ============ validate_file_extension tests ============

    def test_validate_extension_pdf(self):
        """Test validation of PDF extension."""
        result = FileValidator.validate_file_extension("document.pdf")
        assert result is True

    def test_validate_extension_docx(self):
        """Test validation of DOCX extension."""
        result = FileValidator.validate_file_extension("document.docx")
        assert result is True

    def test_validate_extension_xlsx(self):
        """Test validation of XLSX extension."""
        result = FileValidator.validate_file_extension("spreadsheet.xlsx")
        assert result is True

    def test_validate_extension_image(self):
        """Test validation of image extensions."""
        assert FileValidator.validate_file_extension("image.png") is True
        assert FileValidator.validate_file_extension("photo.jpg") is True
        assert FileValidator.validate_file_extension("picture.jpeg") is True

    def test_validate_extension_txt(self):
        """Test validation of TXT extension."""
        result = FileValidator.validate_file_extension("readme.txt")
        assert result is True

    def test_validate_extension_exe_rejected(self):
        """Test rejection of executable extension."""
        with pytest.raises(ValidationError):
            FileValidator.validate_file_extension("malware.exe")

    def test_validate_extension_js_rejected(self):
        """Test rejection of JavaScript extension."""
        with pytest.raises(ValidationError):
            FileValidator.validate_file_extension("script.js")

    def test_validate_extension_php_rejected(self):
        """Test rejection of PHP extension."""
        with pytest.raises(ValidationError):
            FileValidator.validate_file_extension("backdoor.php")

    def test_validate_extension_case_insensitive(self):
        """Test case insensitive extension validation."""
        assert FileValidator.validate_file_extension("DOCUMENT.PDF") is True
        assert FileValidator.validate_file_extension("Document.Pdf") is True

    def test_validate_extension_no_extension_rejected(self):
        """Test handling of file without extension."""
        with pytest.raises(ValidationError):
            FileValidator.validate_file_extension("noextension")

    # ============ validate_file_size tests ============

    def test_validate_size_within_limit(self):
        """Test file within size limit."""
        result = FileValidator.validate_file_size(1000, max_size=10000)
        assert result is True

    def test_validate_size_at_limit(self):
        """Test file at exact size limit."""
        result = FileValidator.validate_file_size(10000, max_size=10000)
        assert result is True

    def test_validate_size_exceeds_limit(self):
        """Test file exceeding size limit raises error."""
        with pytest.raises(ValidationError):
            FileValidator.validate_file_size(10001, max_size=10000)

    def test_validate_size_empty_file(self):
        """Test empty file passes validation."""
        result = FileValidator.validate_file_size(0, max_size=10000)
        assert result is True

    # ============ validate_mime_type tests ============

    @pytest.mark.asyncio
    async def test_validate_mime_type_pdf(self):
        """Test MIME type validation for PDF."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/pdf"

            content = b"%PDF-1.4"
            result = await FileValidator.validate_mime_type(content, "document.pdf")
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_mime_type_mismatch(self):
        """Test MIME type mismatch (exe disguised as pdf)."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/x-executable"

            content = b"MZ"  # EXE magic bytes
            with pytest.raises(ValidationError):
                await FileValidator.validate_mime_type(content, "malware.pdf")

    @pytest.mark.asyncio
    async def test_validate_mime_type_docx(self):
        """Test MIME type validation for DOCX."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

            content = b"PK"  # ZIP magic bytes (DOCX is a ZIP)
            result = await FileValidator.validate_mime_type(content, "document.docx")
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_mime_type_image_png(self):
        """Test MIME type validation for PNG."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "image/png"

            content = b"\x89PNG\r\n\x1a\n"  # PNG magic bytes
            result = await FileValidator.validate_mime_type(content, "image.png")
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_mime_type_image_jpeg(self):
        """Test MIME type validation for JPEG."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "image/jpeg"

            content = b"\xff\xd8\xff"  # JPEG magic bytes
            result = await FileValidator.validate_mime_type(content, "photo.jpg")
            assert result is True

    # ============ validate_upload integration tests ============

    @pytest.mark.asyncio
    async def test_validate_upload_success(self):
        """Test complete upload validation success."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/pdf"

            content = b"%PDF-1.4 test content"
            filename = "test_document.pdf"

            safe_name, size = await FileValidator.validate_upload(
                content,
                filename,
                max_size=1000000
            )

            assert safe_name == "test_document.pdf"
            assert size == len(content)

    @pytest.mark.asyncio
    async def test_validate_upload_invalid_extension(self):
        """Test upload validation with invalid extension."""
        content = b"test content"
        filename = "malware.exe"

        with pytest.raises(ValidationError):
            await FileValidator.validate_upload(
                content,
                filename,
                max_size=1000000
            )

    @pytest.mark.asyncio
    async def test_validate_upload_exceeds_size(self):
        """Test upload validation with oversized file."""
        content = b"x" * 10001
        filename = "document.pdf"

        with pytest.raises(ValidationError):
            await FileValidator.validate_upload(
                content,
                filename,
                max_size=10000
            )

    @pytest.mark.asyncio
    async def test_validate_upload_mime_mismatch(self):
        """Test upload validation with MIME type mismatch."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/x-executable"

            content = b"MZ executable"
            filename = "disguised.pdf"

            with pytest.raises(ValidationError):
                await FileValidator.validate_upload(
                    content,
                    filename,
                    max_size=1000000
                )

    @pytest.mark.asyncio
    async def test_validate_upload_path_traversal_sanitized(self):
        """Test that path traversal is sanitized in upload."""
        with patch("Backend.Source.Utils.FileValidator.magic") as mock_magic:
            mock_magic.from_buffer.return_value = "application/pdf"

            content = b"%PDF-1.4 test"
            filename = "../../../etc/document.pdf"

            safe_name, _ = await FileValidator.validate_upload(
                content,
                filename,
                max_size=1000000
            )

            assert ".." not in safe_name
            assert "/" not in safe_name
