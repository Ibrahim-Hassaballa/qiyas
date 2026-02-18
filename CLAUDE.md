# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QiyasAI Copilot is a multi-tenant AI-powered document analysis and conversational assistant. It combines RAG (Retrieval-Augmented Generation) with Azure OpenAI (and optionally Groq), allowing organizations to upload documents, ask questions, and get AI-powered responses grounded in both a permanent knowledge base and session-specific uploads. The system supports multiple tenants (organizations), role-based access control, i18n (English/Arabic with RTL), dark/light theming, and an admin dashboard.

## Development Commands

### Running Locally (Windows)

```powershell
# Start both frontend and backend
.\run.ps1

# Backend only (requires .venv activated)
.\.venv\Scripts\activate
pip install -r Backend/requirements.txt
python -m Backend.Source.Main

# Frontend only
cd Frontend
npm install
npm run dev
```

### Docker Deployment

```bash
docker compose up --build        # Start all services (PostgreSQL, Redis, Backend, Frontend)
docker compose down              # Stop all services
docker compose logs backend -f   # Tail backend logs
```

Docker stack: PostgreSQL 16 + Redis 7 + Backend (port 8000) + Frontend (port 80). Backend waits for healthy DB and Redis before starting.

### Build & Lint

```bash
# Frontend
cd Frontend && npm run build     # Production build -> Frontend/dist/
cd Frontend && npm run lint      # ESLint

# Backend
pip install ruff
ruff check Backend/
```

### Tests

```bash
# Backend (pytest + pytest-asyncio)
cd Backend && python -m pytest tests/ -v
cd Backend && python -m pytest tests/unit/ -v           # Unit tests only
cd Backend && python -m pytest tests/integration/ -v    # Integration tests only
cd Backend && python -m pytest tests/unit/services/test_chat_history_service.py -v  # Single file

# Frontend (vitest + @testing-library/react)
cd Frontend && npm test              # Run all tests
cd Frontend && npm test -- --run     # Run once (no watch)
cd Frontend && npx vitest run Source/__tests__/translations.test.jsx  # Single file
```

**Note:** Backend integration tests are currently stale — they reference old default admin credentials and missing endpoints. Unit tests for services may also need `tenant_id` parameters added after the multi-tenant refactor.

### Knowledge Base Ingestion

```bash
# Place files in Data/Raw/ then run:
python Scripts/ingest_documents.py
```

## Architecture

**Backend**: Python/FastAPI (port 8000), entry point `Backend.Source.Main:app`
**Frontend**: React 19 + Vite (port 5173 dev, proxies `/api` to backend), Tailwind CSS v4
**Database**: PostgreSQL in production, SQLite for local dev (`Backend/Data/qiyas.db`)
**Vector DB**: ChromaDB with Azure OpenAI embeddings (`text-embedding-ada-002`)
**Cache/Rate Limiting**: Redis intended for production, but currently in-memory everywhere (see Known Limitations)
**AI Providers**: Azure OpenAI (primary) + Groq (optional, configurable per-tenant in settings)

### Multi-Tenancy Model

The system uses **row-level tenant isolation** (not schema separation):

- **Tenant** -> has many **Users** -> each has many **Conversations** -> each has many **Messages**
- Every Conversation is scoped by `tenant_id` + `user_id`
- Registration creates a Tenant (organization) + an Owner user in one transaction
- Tenant has a `plan` field (`free`, `pro`, `enterprise`) and a URL-safe `slug`
- ChromaDB collections are per-tenant: `tenant_{id[:8]}_standards` and `tenant_{id[:8]}_sessions`
- Tenant document uploads stored in `Data/Tenants/{tenant_id}/Raw/`

### Role-Based Access Control (RBAC)

Three roles enforced via `require_role()` dependency in `Backend/Source/Core/Dependencies.py`:

| Role | Chat | Own Data | Admin Dashboard | Manage Users/Tenants |
|------|------|----------|-----------------|---------------------|
| **member** | Yes | Yes | No | No |
| **admin** | Yes | Yes | Yes | Yes |
| **owner** | Yes | Yes | Yes | Yes (created on registration) |

Frontend guards: `AdminRoute.jsx` redirects non-admin/owner users away from `/admin`.

### Authentication Flow

1. User logs in with **email** (not username) via `POST /api/auth/token`
2. JWT set in **httpOnly cookie** (not localStorage); CSRF token returned in response body
3. Frontend stores CSRF token in React state, attaches via `X-CSRF-Token` header on non-GET requests
4. Axios interceptor auto-logouts on 401; `withCredentials: true` for all requests
5. JWT payload includes: `sub` (email), `tenant_id`, `role`, `user_id`

**Default admin** (created on first startup via `AuthService.create_default_admin_if_not_exists()`): email `admin@qiyas.ai`, username `Admin`, password `QiyasAdmin2025!`, role `owner`.

### RAG Data Flow

```
User Message -> POST /api/chat (streaming SSE)
  -> Optional Groq topic guard (if configured in tenant settings)
  -> File extraction + session KB ingestion + AI document classification (if attachment)
  -> Query tenant ChromaDB (hybrid search: semantic + lexical via RRF merge)
  -> Query dga_qiyas_controls (permanent/shared global collection)
  -> Build context from retrieved chunks
  -> Azure OpenAI or Groq Chat Completion (streaming)
  -> Stream response via SSE -> Save to ChatHistory
  -> Update user token/cost usage counters
```

**Three ChromaDB collection types**:
1. `dga_qiyas_controls` — permanent, shared across all tenants (ingested via script)
2. `tenant_{id[:8]}_standards` — per-tenant permanent knowledge base
3. `tenant_{id[:8]}_sessions` — per-conversation uploads, filtered by `conversation_id` metadata, deleted when conversation is deleted

### Key Backend Patterns

- **Config**: Pydantic settings from `Backend/.env` (`Backend/Source/Core/Config/Config.py`). App **refuses to start** without `SECRET_KEY` and Azure credentials (validated in `Config/Validator.py`).
- **Dependencies**: `get_current_user_from_cookie` (defined in `Auth.py`, re-exported as `get_current_user`), `get_current_tenant` for tenant context, `require_role()` for RBAC — latter two in `Dependencies.py`
- **Services layer**: Business logic in `Backend/Source/Services/`, routes are thin wrappers. All services use module-level singletons (e.g., `auth_service = AuthService()`).
- **DB sessions**: Mixed pattern — `ChatHistoryService` and `SettingsService` create their own `SessionLocal()` sessions internally; other services receive sessions via FastAPI `Depends(get_db)`.
- **Exception hierarchy**: Custom exceptions in `Core/Exceptions.py` with global handlers returning structured JSON
- **Rate limiting**: Per-route via `@limiter.limit()` decorator (5/min auth, 20/min chat, 10/min upload)
- **Migrations**: Hand-rolled idempotent column additions in `Database.py` (Alembic is in requirements but not used)
- **Logging**: Structured JSON logging with `RotatingFileHandler` (10MB, 5 backups) in `Core/Logging.py`

### API Route Prefixes

| Prefix | File | Purpose |
|--------|------|---------|
| `/api/auth` | `Auth.py` | Login, register, logout, /me, CSRF |
| `/api/chat` | `Chat.py` | Streaming chat with RAG |
| `/api/controls` | `Controls.py` | Document list/upload/delete |
| `/api/history` | `History.py` | Conversation CRUD |
| `/api/settings` | `Settings.py` | Tenant settings get/post |
| `/api/admin` | `Admin.py` | Tenant/user management, analytics, health, logs |

### Frontend Structure

- **Pages**: `LoginPage`, `RegisterPage`, `ChatPage`, `AdminPage`
- **Context providers** (outermost first in `App.jsx`): `LocaleProvider` -> `ThemeProvider` -> `AuthProvider` -> `ToastProvider` -> `Router`
- **Auth**: `AuthContext.jsx` provides `useAuth()` hook; handles JWT cookies + CSRF transparently via axios interceptors
- **i18n**: `LocaleContext.jsx` wraps i18next with `en` and `ar` locales. Sets `dir="rtl"` for Arabic. Translation files in `Frontend/Source/i18n/en.json` and `ar.json`. Provides `t()`, `formatNumber()`, `formatDate()`.
- **Theme**: `ThemeContext.jsx` provides dark/light toggle, persisted in `localStorage`
- **Toast**: `Toast.jsx` provides toast notification context and component
- **Chat hook**: `useChat.js` manages conversation state, streaming SSE (uses `fetch`, not axios), file uploads, retry logic
- **Admin dashboard**: Tabs split into `Components/Admin/` — OverviewTab, TenantsTab, UsersTab, HealthTab, LogsTab, SettingsTab, plus modals
- **API client**: `Services/api.js` — axios instance with `baseURL: '/api'`, `withCredentials: true`

### AI Service Architecture

`AIService.py` provides two AI backends via `get_ai_service(provider)` factory:

- **AzureOpenAIService** — `AsyncAzureOpenAI` for chat streaming + synchronous `AzureOpenAI` for embeddings. Includes 3-tier document classification: (1) filename regex, (2) cosine similarity against pre-embedded standard descriptions, (3) LLM fallback.
- **GroqAIService** — `AsyncGroq` client, lazy-initialized singleton. Used when tenant settings set `model_provider: "groq"`.

Both expose `get_chat_response()` returning an async streaming generator.

## Environment Configuration

Backend requires `Backend/.env`. See `Backend/.env.example` for template. Critical variables:

```env
# REQUIRED - app won't start without this
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(32))">

# Database (PostgreSQL for production, omit for SQLite dev)
DATABASE_URL=postgresql://qiyas:password@localhost:5432/qiyasai

# Redis (required for production rate limiting)
REDIS_URL=redis://localhost:6379/0

# Azure OpenAI (both chat and embeddings endpoints required)
AZURE_CHAT_ENDPOINT=...
AZURE_CHAT_KEY=...
AZURE_CHAT_DEPLOYMENT=...
AZURE_EMBEDDING_ENDPOINT=...
AZURE_EMBEDDING_KEY=...
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-ada-002

# Optional: Groq (enables alternative AI provider)
GROQ_API_KEY=...

# CORS (must include frontend origin)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Common Tasks

### Adding a New API Endpoint
1. Create route in `Backend/Source/Api/Routes/<File>.py` with an `APIRouter`
2. Register in `Backend/Source/Main.py`: `app.include_router(router, prefix="/api/...")`
3. Add service logic in `Backend/Source/Services/` if non-trivial
4. Use `Depends(get_current_user_from_cookie)` for auth, `Depends(require_role("admin"))` for RBAC

### Adding a New Frontend Page
1. Create page in `Frontend/Source/Pages/<Page>.jsx`
2. Add route in `Frontend/Source/App.jsx` (wrap with `AdminRoute` if admin-only)
3. Add translation keys to both `Frontend/Source/i18n/en.json` and `ar.json`

### Modifying RAG Behavior
- Retrieval: `KnowledgeBaseService.py` — `query()`, `search_hybrid()` (RRF merge), `search_exact()`, `get_neighbors()`
- Chunking: `IngestionService.py` — configurable `chunk_size` (default 1000) and `overlap` (100)
- LLM params: `AIService.get_chat_response()` — temperature, max_tokens, etc.
- Result count: `n_results` parameter in `Chat.py` route

### Adding Translations
- Add keys to both `Frontend/Source/i18n/en.json` and `ar.json` (must maintain parity)
- Use `t('section.key')` in components via `useTranslation()` from react-i18next or `useLocale()` from `LocaleContext`
- Sections: `common`, `language`, `theme`, `chat`, `settings`, `toast`, `auth`, `admin`, `errors`, `status`

## Known Limitations

- **CSRF tokens are in-memory**: Stored in a Python dict (`Utils/CSRF.py`), not Redis. Lost on restart, breaks with multiple workers.
- **Rate limiting is in-memory**: `RateLimiting.py` uses `storage_uri="memory://"` despite Redis being available in Docker.
- **Sync embedding calls in async context**: `AIService.py` uses a synchronous `AzureOpenAI` client for embeddings, which blocks the event loop during `analyze_document_for_standard()`.
- **Groq topic guard blocks event loop**: `Chat.py` creates a synchronous OpenAI client for the Groq topic guard inside an async endpoint.
- **No Alembic migrations**: Despite being in requirements, migrations are hand-rolled in `Database.py` with idempotent `ADD COLUMN` statements.
- **`Message.attachment_content`**: Stores full extracted document text in the SQL database (Text column), which can be very large for big PDFs.
