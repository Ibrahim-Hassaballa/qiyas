# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QiyasAI Copilot is an AI-powered document analysis and conversational assistant that combines RAG (Retrieval-Augmented Generation) with Azure OpenAI. The application allows users to upload documents, ask questions, and get AI-powered responses grounded in both a permanent knowledge base and session-specific document uploads.

## Architecture

### Backend (Python/FastAPI)
- **Location**: `Backend/Source/`
- **Framework**: FastAPI with Uvicorn server
- **Port**: 8000 (configured in `Backend/.env`)
- **Entry Point**: `Backend.Source.Main:app`

#### Key Components
- **API Routes** (`Backend/Source/Api/Routes/`):
  - `Auth.py` - User authentication (login, register, token refresh)
  - `Chat.py` - Streaming chat endpoint with RAG integration
  - `Controls.py` - Document ingestion controls
  - `History.py` - Chat history CRUD operations
  - `Settings.py` - User settings management

- **Services** (`Backend/Source/Services/`):
  - `AIService.py` - Azure OpenAI client wrapper (chat + embeddings)
  - `KnowledgeBaseService.py` - ChromaDB vector store manager with dual collections
  - `IngestionService.py` - Document processing (PDF, DOCX, Excel, images with OCR)
  - `AuthService.py` - User authentication and JWT token management
  - `ChatHistoryService.py` - Conversation persistence
  - `DocumentService.py` - File upload handling

- **Core** (`Backend/Source/Core/`):
  - `Config/Config.py` - Pydantic settings loading from `Backend/.env`
  - `Database.py` - SQLAlchemy setup with SQLite (`Backend/Data/qiyas.db`)
  - `Security.py` - Password hashing (bcrypt) and JWT token creation
  - `Logging.py` - Structured logging with JSON and text formatters
  - `Exceptions.py` - Custom exception hierarchy for error handling

- **Middleware** (`Backend/Source/Middleware/`):
  - `RateLimiting.py` - Request rate limiting using slowapi

- **Utilities** (`Backend/Source/Utils/`):
  - `FileValidator.py` - Multi-layer file upload validation
  - `CSRF.py` - CSRF token generation and validation

### Frontend (React/Vite)
- **Location**: `Frontend/Source/`
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Port**: 5173 (Vite default, proxies `/api` to backend:8000)

#### Key Components
- **Pages**:
  - `LoginPage.jsx` / `RegisterPage.jsx` - Authentication UI
  - `ChatPage.jsx` - Main chat interface with sidebar

- **Components**:
  - `ChatBubble.jsx` - Message rendering (supports markdown with react-markdown)
  - `ChatHeader.jsx` - Top bar with settings button
  - `ChatSidebar.jsx` - Conversation history list
  - `MessageInput.jsx` - Input field with file upload
  - `SettingsModal.jsx` - User preferences
  - `DeleteConfirmModal.jsx` - Conversation deletion confirmation

- **Context**:
  - `AuthContext.jsx` - Global auth state (JWT in httpOnly cookies, CSRF protection)

### Vector Database (ChromaDB)
- **Two Collections**:
  1. **`dga_qiyas_controls`** - Permanent knowledge base (ingested via `Scripts/ingest_documents.py`)
  2. **`SessionKnowledgeBase`** - Per-conversation document uploads (deleted when conversation is deleted)
- **Location**: Configured via `CHROMA_DB_PATH` in `.env` (typically `Data/KnowledgeBase/`)
- **Embedding Function**: Custom Azure OpenAI embeddings using `text-embedding-ada-002`

### Data Flow
```
User Message → Frontend (ChatPage)
            ↓
    POST /api/chat (streaming SSE)
            ↓
    Query SessionKnowledgeBase (conversation-specific docs)
            ↓
    Query dga_qiyas_controls (permanent knowledge base)
            ↓
    Build context from retrieved chunks
            ↓
    Azure OpenAI Chat Completion (streaming)
            ↓
    Stream response back to Frontend
            ↓
    Save to ChatHistory (SQLite)
```

## Security Features

### Authentication & Authorization

**Cookie-Based JWT Authentication**:
- JWTs stored in **httpOnly cookies** (not localStorage) - prevents XSS attacks
- Cookie attributes: `httpOnly=true`, `secure=true` (production), `samesite=lax`
- Token expiry: 24 hours (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Automatic logout on 401 responses via axios interceptor

**CSRF Protection**:
- CSRF tokens generated server-side using cryptographically secure random values
- Tokens validated on all non-GET requests via `X-CSRF-Token` header
- 1-hour token expiry with automatic cleanup
- Frontend automatically attaches CSRF token to all state-changing requests

**Authentication Flow**:
1. User logs in via `/api/auth/token` (rate limited: 5/minute)
2. Backend validates credentials and creates JWT
3. JWT set in httpOnly cookie via `Set-Cookie` header
4. CSRF token returned in response body
5. Frontend stores CSRF token in state and attaches to requests
6. Protected endpoints validate both cookie JWT and CSRF token

**Default User**:
- Username: `Qiyas`
- Password: `1208` (should be changed in production)
- Created automatically on first startup

### Rate Limiting

Rate limits prevent brute force attacks and API abuse:
- **Authentication endpoints** (`/api/auth/token`, `/api/auth/register`): 5 requests/minute
- **Chat endpoint** (`/api/chat`): 20 requests/minute
- **File upload endpoint** (`/api/controls/upload`): 10 requests/minute
- Identifier: IP address + user ID (for authenticated requests)
- Storage: In-memory (use Redis in production)
- Response: 429 Too Many Requests with `Retry-After` header

**Configuration**:
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_CHAT=20/minute
RATE_LIMIT_UPLOAD=10/minute
```

### File Upload Security

**Multi-Layer Validation** (via `FileValidator.py`):
1. **Filename Sanitization**: Removes path traversal attempts (`../`, `..\\`), null bytes
2. **Extension Whitelist**: Only allows `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.txt`, `.png`, `.jpg`, `.jpeg`
3. **File Size Limits**:
   - General uploads (controls): 50MB (`MAX_FILE_SIZE_GENERAL`)
   - Chat attachments: 25MB (`MAX_FILE_SIZE_CHAT`)
4. **MIME Type Validation**: Uses `python-magic` to verify actual file content (prevents `.exe` → `.pdf` spoofing)

**File Processing Security**:
- All file operations use sanitized filenames
- Uploaded files validated before saving to disk
- Failed ingestion triggers automatic file deletion
- All operations logged with user ID for audit trail

### Structured Logging

**Log Formats**:
- **JSON format** (production): Machine-readable structured logs with timestamps, levels, context
- **Text format** (development): Human-readable colored console output

**Log Levels**:
- `DEBUG`: Detailed diagnostic information (RAG queries, chunk counts, etc.)
- `INFO`: General informational messages (startup, user actions)
- `WARNING`: Potentially problematic situations (validation failures, fallbacks)
- `ERROR`: Error events with full stack traces

**Log Rotation**:
- File: `logs/qiyasai.log`
- Rotation: 10MB per file, 5 backup files
- Encoding: UTF-8

**Logged Information**:
- All HTTP requests with UUID `request_id`, duration, status code, IP address
- Authentication attempts (success/failure) with username
- File uploads with size, filename, user ID
- Errors with full stack traces via `exc_info=True`
- Rate limit violations with IP and endpoint

### Error Handling

**Custom Exception Hierarchy** (`Backend/Source/Core/Exceptions.py`):
- `QiyasAIException` - Base exception with status code and details
- `AuthenticationError` (401) - Invalid credentials, missing token
- `AuthorizationError` (403) - Insufficient permissions
- `ValidationError` (400) - Invalid input, file validation failures
- `FileProcessingError` (422) - Document extraction errors
- `RateLimitExceeded` (429) - Too many requests
- `ResourceNotFoundError` (404) - Resource not found

**Global Exception Handlers**:
- All custom exceptions return structured JSON responses
- Unexpected exceptions logged with full context (request ID, path, user)
- Error responses include error type, message, and request ID for tracking

### CORS Policy

**Strict Origin Control**:
- No wildcard origins (`*`) - only specific allowed origins
- Configured via `CORS_ORIGINS` (comma-separated list)
- Default: `http://localhost:5173,http://127.0.0.1:5173`
- Credentials allowed: `allow_credentials=true` (required for cookies)

### Middleware Stack

**Request Logging Middleware**:
- Generates UUID for each request (`X-Request-ID` header)
- Logs request start with method, path, IP
- Measures request duration
- Logs completion with status code and duration
- Attaches request ID to response headers

**Rate Limiting Middleware**:
- Applied per-route via `@limiter.limit()` decorator
- Uses fixed-window strategy
- Custom identifier function (IP + user ID)
- Rate limit state stored in `app.state.limiter`

### Secret Management

**Required Secrets** (never hardcoded):
- `SECRET_KEY`: JWT signing key (32+ bytes, cryptographically random)
- Generate: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- Application **fails to start** if `SECRET_KEY` not in `.env`

**Azure OpenAI Keys**:
- Separate keys for chat and embeddings
- Loaded from environment variables only
- Never logged or exposed in error messages

### Security Best Practices

**For Development**:
- Use `.env` file with `COOKIE_SECURE=false` (HTTP allowed)
- Keep default CORS origins (localhost)
- Log level: `DEBUG` or `INFO`

**For Production**:
- Set `COOKIE_SECURE=true` (HTTPS only)
- Use specific domain in `COOKIE_DOMAIN`
- Update `CORS_ORIGINS` to production domain
- Set `LOG_LEVEL=WARNING` or `ERROR`
- Use Redis for rate limiting: `storage_uri="redis://localhost:6379"`
- Change default user password
- Enable firewall/IP whitelisting
- Set up log aggregation (ELK, Datadog, etc.)
- Regular security scans (OWASP ZAP, etc.)

## Development Commands

### Running the Application

**Start Both Frontend and Backend (Windows)**:
```powershell
.\run.ps1
```
This opens two PowerShell windows: one for backend, one for frontend.

**Backend Only**:
```bash
# Activate virtual environment first
.\.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r Backend/requirements.txt

# Run server with hot reload
python -m Backend.Source.Main
```

**Frontend Only**:
```bash
cd Frontend
npm install
npm run dev
```

### Building and Linting

**Frontend**:
```bash
cd Frontend
npm run build    # Production build → Frontend/dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

**Backend**:
No build step required for Python. For linting/formatting, install tools manually (not in requirements.txt):
```bash
pip install ruff  # or black, flake8, etc.
ruff check Backend/
```

### Knowledge Base Management

**Ingest Documents to Permanent Knowledge Base**:
```bash
# Place files in Data/Raw/ (PDF, DOCX, XLSX, PNG/JPG)
python Scripts/ingest_documents.py
```
This processes all files in `Data/Raw/` and adds them to the `dga_qiyas_controls` ChromaDB collection.

**Note**: Session uploads (via chat interface) go to `SessionKnowledgeBase` and are tied to a conversation ID.

## Environment Configuration

**Backend requires `Backend/.env` with**:

See `Backend/.env.example` for a complete template.

**Required Variables**:
```env
# Security (REQUIRED - generate with: python -c "import secrets; print(secrets.token_urlsafe(32))")
SECRET_KEY=your_generated_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Azure OpenAI Chat
AZURE_CHAT_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_CHAT_KEY=your_key
AZURE_CHAT_DEPLOYMENT=your_gpt4_deployment_name
AZURE_CHAT_API_VERSION=2024-02-15-preview

# Azure OpenAI Embeddings
AZURE_EMBEDDING_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_EMBEDDING_KEY=your_key
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
AZURE_EMBEDDING_API_VERSION=2023-05-15

# Server
HOST=127.0.0.1
PORT=8000

# ChromaDB
CHROMA_DB_PATH=Data/KnowledgeBase

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH=5/minute
RATE_LIMIT_CHAT=20/minute
RATE_LIMIT_UPLOAD=10/minute

# File Upload Limits (bytes)
MAX_FILE_SIZE_GENERAL=52428800  # 50MB
MAX_FILE_SIZE_CHAT=26214400     # 25MB
ALLOWED_FILE_EXTENSIONS=.pdf,.docx,.doc,.xlsx,.xls,.txt,.png,.jpg,.jpeg

# Cookie Settings
COOKIE_SECURE=false  # Set to true in production (requires HTTPS)
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=      # Leave empty for development, set to domain in production

# Logging
LOG_LEVEL=INFO      # DEBUG, INFO, WARNING, ERROR
LOG_FORMAT=json     # json or text
LOG_FILE=logs/qiyasai.log
```

**IMPORTANT**: `SECRET_KEY` is **required**. The application will fail to start without it. Generate a secure key using:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Important Implementation Details

### Authentication Flow (Cookie-Based)
1. User registers/logs in via `/api/auth/register` or `/api/auth/token`
2. Backend validates credentials and creates JWT (24-hour expiry)
3. Backend sets JWT in **httpOnly cookie** via `Set-Cookie` header
4. Backend returns CSRF token in response body
5. Frontend stores CSRF token in state (not in localStorage/cookies)
6. Frontend includes CSRF token in `X-CSRF-Token` header for non-GET requests
7. Protected routes use `useAuth()` hook to check authentication status
8. Cookies automatically sent by browser on all requests (`withCredentials: true`)
9. On logout, backend clears cookie via `response.delete_cookie()`

**Default User**:
- Username: `Qiyas`
- Password: `1208`
- Created automatically on startup if no users exist

### RAG Search Strategy
The knowledge base service uses a **dual-search approach**:
- **Semantic Search** (`query()`) - Vector similarity search (default, configurable `n_results`)
- **Exact Search** (`search_exact()`) - Full-text filtering for precise ID/control number lookup
- **Neighbor Expansion** (`get_neighbors()`) - Retrieves adjacent chunks by `chunk_index` for context

### Session Knowledge Base
- Each conversation can have uploaded documents stored in `SessionKnowledgeBase`
- Documents are tagged with `conversation_id` metadata
- When a conversation is deleted, its session documents are purged via `delete_session_data()`
- Session queries filter by `conversation_id` to isolate documents per conversation

### Document Processing
`IngestionService` supports:
- **PDF**: PyMuPDF (fitz) + pypdf fallback
- **DOCX**: python-docx
- **Excel**: pandas + openpyxl
- **Images**: pytesseract for OCR (requires Tesseract installed on system)

Chunking strategy:
- Configurable `chunk_size` (default 1000 chars)
- `overlap` of 100 chars to preserve context across boundaries
- Chunks stored with `source`, `chunk_index` metadata

### Frontend API Client
- Uses `axios` for HTTP requests
- Base URL handled by Vite proxy (`vite.config.js` proxies `/api` → `http://127.0.0.1:8000`)
- **Cookie credentials** enabled via `axios.defaults.withCredentials = true`
- **CSRF token** attached to non-GET requests via axios request interceptor
- **Auto-logout** on 401 responses via axios response interceptor
- No manual token management needed (browser handles cookies automatically)

## Testing

No test suite is currently configured. To add tests:

**Backend**:
```bash
pip install pytest pytest-asyncio httpx
# Create tests/ directory and write test_*.py files
pytest
```

**Frontend**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
# Add test script to package.json: "test": "vitest"
npm test
```

## Common Tasks

### Adding a New API Endpoint
1. Create route function in `Backend/Source/Api/Routes/<YourFile>.py`
2. Include router in `Backend/Source/Main.py`: `app.include_router(YourFile.router, prefix="/api/yourprefix")`
3. Update frontend API call in relevant component

### Adding a New Frontend Page
1. Create page in `Frontend/Source/Pages/<PageName>.jsx`
2. Add route in `Frontend/Source/App.jsx` within `<Routes>`
3. Update navigation (if needed) in `ChatHeader.jsx` or create new nav component

### Modifying Vector Search Behavior
- Edit `KnowledgeBaseService.py` methods: `query()`, `search_exact()`, `get_neighbors()`
- Adjust `n_results` parameter in `Chat.py` route to change retrieval count
- For different chunking strategies, modify `add_session_document()` or `IngestionService`

### Changing LLM Model or Parameters
- Update `AZURE_CHAT_DEPLOYMENT` in `.env` to point to different deployment
- Modify `AIService.get_chat_response()` to add parameters like `temperature`, `max_tokens`
