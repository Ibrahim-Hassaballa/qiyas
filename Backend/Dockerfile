# QiyasAI Backend Dockerfile
# Multi-stage build for Python FastAPI application

FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.docker.txt .
RUN pip install --user -r requirements.docker.txt


# Production stage
FROM python:3.11-slim AS production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/root/.local/bin:$PATH"

WORKDIR /app

# Install runtime dependencies
# - tesseract-ocr: Required by pytesseract for OCR
# - tesseract-ocr-ara: Arabic language pack for Tesseract
# - libmagic1: Required by python-magic for file type detection
# - poppler-utils: Required by pdf2image for PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ara \
    tesseract-ocr-eng \
    libmagic1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application source code
COPY Source/ ./Backend/Source/
COPY Data/ ./Backend/Data/

# Create directories for logs and data persistence
RUN mkdir -p /app/logs /app/Data/KnowledgeBase /app/Backend/Data

# Expose the backend port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "Backend.Source.Main:app", "--host", "0.0.0.0", "--port", "8000"]
