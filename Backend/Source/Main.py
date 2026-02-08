from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from slowapi.errors import RateLimitExceeded
import uuid
import time
from Backend.Source.Core.Config.Config import settings
from Backend.Source.Core.Logging import logger
from Backend.Source.Core.Exceptions import QiyasAIException
from Backend.Source.Core.Config.Validator import validate_config
from Backend.Source.Middleware.RateLimiting import limiter, rate_limit_exceeded_handler
from Backend.Source.Api.Routes import Chat, Controls, Settings, Auth, History
from Backend.Source.Core.Database import engine, Base
from Backend.Source.Services.AuthService import auth_service
from Backend.Source.Core.Database import SessionLocal

# Validate configuration at startup (fail fast with clear errors)
validate_config(settings)

# Create Tables
Base.metadata.create_all(bind=engine)

# Create Default User
db = SessionLocal()
try:
    auth_service.create_default_user_if_not_exists(db)
finally:
    db.close()

app = FastAPI(
    title="QiyasAI Copilot",
    description="Backend for QiyasAI Copilot using Azure OpenAI",
    version="1.0.0"
)

# Add rate limiter state
app.state.limiter = limiter

# Register rate limit exception handler
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# CORS Middleware
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(',')]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"],
    expose_headers=["X-Request-ID"]
)


# Request Logging Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all HTTP requests with timing and metadata"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    start_time = time.time()

    # Log request
    logger.info(
        f"Request started: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "ip_address": request.client.host if request.client else "unknown"
        }
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log response
    logger.info(
        f"Request completed: {request.method} {request.url.path} - {response.status_code}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": round(duration * 1000, 2)
        }
    )

    # Add request ID to response headers
    response.headers["X-Request-ID"] = request_id

    return response


# Global Exception Handler
@app.exception_handler(QiyasAIException)
async def qiyasai_exception_handler(request: Request, exc: QiyasAIException):
    """Handle custom QiyasAI exceptions"""
    logger.error(
        f"Application error: {exc.message}",
        extra={
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "status_code": exc.status_code,
            "details": exc.details
        }
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI validation errors (422) and log details"""
    error_details = []
    for error in exc.errors():
        error_details.append({
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "type": error.get("type")
        })
    
    logger.error(
        f"Validation error: {len(error_details)} validation issue(s)",
        extra={
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "path": request.url.path,
            "errors": error_details
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "ValidationError",
            "message": "Request validation failed",
            "details": error_details
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.exception(
        f"Unhandled exception: {str(exc)}",
        extra={
            "request_id": getattr(request.state, 'request_id', 'unknown'),
            "path": request.url.path
        }
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "request_id": getattr(request.state, 'request_id', 'unknown')
        }
    )


# Include Routers (Rate limits applied in route files)
app.include_router(Auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(Chat.router, prefix="/api", tags=["Chat"])
app.include_router(Controls.router, prefix="/api/controls", tags=["Controls"])
app.include_router(History.router)
app.include_router(Settings.router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "message": "QiyasAI Backend is running",
        "version": "1.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting QiyasAI Backend on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "Backend.Source.Main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        reload_excludes=["logs", "Backend/Data"]
    )
