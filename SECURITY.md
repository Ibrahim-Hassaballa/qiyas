# Security Documentation - QiyasAI

This document provides comprehensive security information for QiyasAI Copilot, including authentication mechanisms, security controls, vulnerability mitigations, and incident response procedures.

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [CSRF Protection](#csrf-protection)
3. [File Upload Security](#file-upload-security)
4. [Rate Limiting](#rate-limiting)
5. [Structured Logging & Audit](#structured-logging--audit)
6. [Secret Management](#secret-management)
7. [CORS Policy](#cors-policy)
8. [Vulnerability Mitigation](#vulnerability-mitigation)
9. [Security Testing](#security-testing)
10. [Incident Response](#incident-response)
11. [Production Security Checklist](#production-security-checklist)

---

## Authentication & Authorization

### Cookie-Based JWT Authentication

QiyasAI uses **httpOnly cookies** for JWT storage instead of localStorage to prevent XSS attacks.

#### Authentication Flow Diagram

```
┌─────────┐                                      ┌─────────┐
│ Client  │                                      │ Server  │
└────┬────┘                                      └────┬────┘
     │                                                │
     │  POST /api/auth/token                         │
     │  (username, password)                         │
     ├──────────────────────────────────────────────>│
     │                                                │
     │                                    ┌───────────┴──────────┐
     │                                    │ Validate credentials │
     │                                    │ Create JWT           │
     │                                    │ Generate CSRF token  │
     │                                    └───────────┬──────────┘
     │                                                │
     │  Set-Cookie: access_token (httpOnly)          │
     │  Response: { csrf_token: "..." }              │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  Store CSRF token in state                    │
     │                                                │
     │  POST /api/chat                               │
     │  Cookie: access_token                         │
     │  X-CSRF-Token: <csrf_token>                   │
     ├──────────────────────────────────────────────>│
     │                                                │
     │                                    ┌───────────┴──────────┐
     │                                    │ Validate cookie JWT  │
     │                                    │ Validate CSRF token  │
     │                                    │ Process request      │
     │                                    └───────────┬──────────┘
     │                                                │
     │  Response with data                           │
     │<──────────────────────────────────────────────┤
     │                                                │
```

#### Cookie Configuration

Cookies are configured with the following security attributes:

```python
response.set_cookie(
    key="access_token",
    value=access_token,
    httponly=True,        # JavaScript cannot access cookie (XSS protection)
    secure=True,          # Only sent over HTTPS (production)
    samesite="lax",       # CSRF protection (prevents cross-site cookie sending)
    max_age=86400,        # 24 hours
    domain=None           # Current domain only
)
```

#### Key Security Properties

- **httpOnly**: Cookie is inaccessible to JavaScript via `document.cookie`, preventing XSS theft
- **secure**: Cookie only transmitted over HTTPS in production
- **samesite=lax**: Cookie not sent on cross-origin POST requests (CSRF protection)
- **No localStorage**: Eliminates most common XSS attack vector
- **Automatic expiry**: JWT expires after 24 hours (configurable)

#### Endpoints

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| `/api/auth/token` | POST | 5/minute | Login - returns CSRF token, sets cookie |
| `/api/auth/register` | POST | 5/minute | Registration - returns CSRF token, sets cookie |
| `/api/auth/logout` | POST | None | Clears authentication cookie |
| `/api/auth/me` | GET | None | Returns current user info (requires auth) |
| `/api/auth/csrf` | GET | None | Returns new CSRF token |

---

## CSRF Protection

### How CSRF Protection Works

CSRF (Cross-Site Request Forgery) attacks trick authenticated users into executing unwanted actions. QiyasAI prevents this using the **Double Submit Cookie** pattern with server-side token validation.

#### CSRF Token Lifecycle

1. **Generation**: Server creates cryptographically random token using `secrets.token_urlsafe(32)`
2. **Storage**: Token stored server-side with 1-hour expiry timestamp
3. **Delivery**: Token sent to client in response body (NOT in cookie)
4. **Validation**: Client sends token in `X-CSRF-Token` header on state-changing requests
5. **Verification**: Server validates token exists and hasn't expired
6. **Cleanup**: Expired tokens automatically removed during validation

#### Implementation Details

**Server-Side** (`Backend/Source/Utils/CSRF.py`):
```python
# In-memory store (use Redis in production)
csrf_tokens: dict[str, datetime] = {}
CSRF_TOKEN_EXPIRY = timedelta(hours=1)

def generate_csrf_token() -> str:
    token = secrets.token_urlsafe(32)
    csrf_tokens[token] = datetime.now(timezone.utc) + CSRF_TOKEN_EXPIRY
    return token

def validate_csrf_token(token: Optional[str]) -> bool:
    if not token or token not in csrf_tokens:
        return False
    if datetime.now(timezone.utc) > csrf_tokens[token]:
        del csrf_tokens[token]  # Cleanup expired
        return False
    return True
```

**Client-Side** (`Frontend/Source/Context/AuthContext.jsx`):
```javascript
// Store CSRF token in React state (not cookie)
const [csrfToken, setCsrfToken] = useState(null);

// Attach to non-GET requests
axios.interceptors.request.use((config) => {
    if (config.method !== 'get' && csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
    }
    return config;
});
```

#### Why This Prevents CSRF

- Attacker cannot read CSRF token (Same-Origin Policy prevents cross-origin reads)
- Attacker cannot guess token (cryptographically random, 32 bytes)
- Even if attacker tricks user into making request, it will fail without valid CSRF header
- Cookies alone are insufficient (both cookie AND CSRF header required)

---

## File Upload Security

### Multi-Layer Validation

File uploads undergo **4 layers of validation** before processing:

```
Upload Request
     ↓
1. Filename Sanitization (remove path traversal)
     ↓
2. Extension Whitelist (.pdf, .docx, etc.)
     ↓
3. File Size Check (50MB general, 25MB chat)
     ↓
4. MIME Type Validation (magic number verification)
     ↓
Safe to Process
```

### Validation Layers

#### 1. Filename Sanitization

Prevents **path traversal attacks** by removing malicious path components:

```python
def sanitize_filename(filename: str) -> str:
    # Remove path components
    filename = os.path.basename(filename)
    # Remove null bytes
    filename = filename.replace('\0', '')
    # Remove path traversal attempts
    filename = filename.replace('..', '').replace('/', '').replace('\\', '')
    # Validate not empty
    if not filename:
        raise ValidationError("Invalid filename")
    return filename
```

**Prevented Attacks**:
- `../../etc/passwd.pdf` → `etcpasswd.pdf`
- `../../../windows/system32/config/sam.pdf` → `windowssystem32configsam.pdf`
- Null byte injection: `evil.php\0.pdf` → `evil.php.pdf`

#### 2. Extension Whitelist

Only specific file types allowed (configurable via `ALLOWED_FILE_EXTENSIONS`):

```env
ALLOWED_FILE_EXTENSIONS=.pdf,.docx,.doc,.xlsx,.xls,.txt,.png,.jpg,.jpeg
```

**Prevented Attacks**:
- Executable files: `.exe`, `.bat`, `.sh`, `.msi`
- Script files: `.js`, `.php`, `.py`, `.rb`
- Archive bombs: `.zip`, `.tar`, `.rar`

#### 3. File Size Limits

Prevents **denial of service** via large file uploads:

```env
MAX_FILE_SIZE_GENERAL=52428800   # 50MB (controls ingestion)
MAX_FILE_SIZE_CHAT=26214400      # 25MB (chat attachments)
```

**Prevented Attacks**:
- Memory exhaustion from processing huge files
- Disk space exhaustion
- Slow processing DoS

#### 4. MIME Type Validation

Uses **python-magic** to verify actual file content (magic numbers), not just extension:

```python
def validate_mime_type(file_content: bytes, filename: str):
    mime = magic.Magic(mime=True)
    detected_mime = mime.from_buffer(file_content[:2048])

    extension = os.path.splitext(filename)[1].lower()

    # Map allowed extensions to valid MIME types
    allowed_mimes = {
        '.pdf': ['application/pdf'],
        '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        '.png': ['image/png'],
        # ... etc
    }

    if detected_mime not in allowed_mimes.get(extension, []):
        raise ValidationError(f"File content does not match extension")
```

**Prevented Attacks**:
- MIME type spoofing: `malware.exe` renamed to `document.pdf` (detected as `application/x-dosexec`)
- Polyglot files (valid as multiple types)
- Header manipulation

### File Processing Security

After validation, additional security measures:

- **Atomic operations**: Files saved atomically (temp file → move)
- **Safe filenames used**: Sanitized name used for all disk operations
- **Ingestion failures**: If ChromaDB ingestion fails, file is deleted
- **Audit logging**: All uploads logged with user ID, size, filename
- **Authentication required**: All `/api/controls/*` endpoints require valid JWT

### Example Attack Prevention

**Attack**: Upload `shell.php` renamed as `document.pdf`

```
1. Filename sanitization: shell.php.pdf → shell.php.pdf ✓
2. Extension check: .pdf ✓ (passes - has .pdf extension)
3. Size check: 5KB ✓ (within limits)
4. MIME check: ✗ FAIL (detected as text/x-php, not application/pdf)
   → ValidationError raised
   → HTTP 400 returned to client
   → File never saved to disk
```

---

## Rate Limiting

### Rate Limit Configuration

| Endpoint | Limit | Identifier | Purpose |
|----------|-------|------------|---------|
| `/api/auth/token` | 5/minute | IP + User | Prevent brute force login |
| `/api/auth/register` | 5/minute | IP + User | Prevent account spam |
| `/api/chat` | 20/minute | IP + User | Prevent API abuse |
| `/api/controls/upload` | 10/minute | IP + User | Prevent upload spam |

### Implementation

Uses **slowapi** library with fixed-window strategy:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

def get_identifier(request: Request) -> str:
    """Combine IP address and user ID for rate limiting"""
    user_id = getattr(request.state, 'user_id', None)
    ip_address = get_remote_address(request)
    return f"{ip_address}:{user_id}" if user_id else ip_address

limiter = Limiter(
    key_func=get_identifier,
    enabled=settings.RATE_LIMIT_ENABLED,
    storage_uri="memory://",  # Use "redis://localhost:6379" in production
    strategy="fixed-window"
)

# Applied per-route
@router.post("/token")
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login_for_access_token(...):
    ...
```

### Rate Limit Response

When limit exceeded:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": "RateLimitExceeded",
  "message": "Rate limit exceeded: 5 per 1 minute",
  "retry_after": 60
}
```

### Storage Options

- **Development**: In-memory (fast, resets on restart)
- **Production**: Redis (persistent, distributed, scalable)

```env
# Development
RATE_LIMIT_ENABLED=true

# Production (update RateLimiting.py)
storage_uri="redis://localhost:6379"
```

---

## Structured Logging & Audit

### Log Format

**JSON Format** (production):
```json
{
  "timestamp": "2025-01-22T14:30:15.123456Z",
  "level": "INFO",
  "logger": "Backend.Source.Api.Routes.Chat",
  "message": "User uploaded file",
  "module": "Chat",
  "function": "chat_endpoint",
  "line": 52,
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": 1,
  "filename": "compliance_report.pdf",
  "file_size": 1234567,
  "ip_address": "192.168.1.100"
}
```

**Text Format** (development):
```
2025-01-22 14:30:15,123 INFO [Chat:52] User uploaded file (request_id=a1b2c3d4, user_id=1, filename=compliance_report.pdf)
```

### Log Levels

| Level | Usage | Examples |
|-------|-------|----------|
| **DEBUG** | Diagnostic info | RAG query details, chunk counts, cache hits |
| **INFO** | Normal operations | Startup, user login, file upload, settings change |
| **WARNING** | Recoverable issues | Validation failure, deprecated usage, fallback used |
| **ERROR** | Error events | File processing error, DB connection failure, API error |

### Logged Events

#### Authentication
- Login attempts (success/failure) with username
- Registration with username
- Logout
- Token validation failures

#### File Operations
- File upload with size, filename, user ID
- File validation failures with reason
- Document ingestion success/failure
- File deletion with user ID

#### API Requests
- All requests with method, path, status code, duration
- Request ID (UUID) for correlation
- IP address for security tracking
- User ID (if authenticated)

#### Security Events
- Rate limit violations with IP and endpoint
- CSRF validation failures
- Invalid JWT attempts
- Authorization failures

#### Errors
- All exceptions with full stack trace (`exc_info=True`)
- Request context (request ID, path, user)
- Database errors
- External API errors (Azure OpenAI)

### Log Rotation

```python
# Rotating file handler
handler = RotatingFileHandler(
    filename='logs/qiyasai.log',
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,               # Keep 5 backup files
    encoding='utf-8'
)
```

Total log storage: ~50MB (10MB × 5 backups)

### Audit Trail

For compliance and incident investigation, logs provide:

1. **Who**: User ID from JWT
2. **What**: Action performed (login, upload, chat, delete)
3. **When**: ISO 8601 timestamp with timezone
4. **Where**: IP address, endpoint
5. **How**: Request ID for tracing entire request lifecycle

---

## Secret Management

### Required Secrets

| Secret | Purpose | Generation | Storage |
|--------|---------|------------|---------|
| `SECRET_KEY` | JWT signing | `python -c "import secrets; print(secrets.token_urlsafe(32))"` | `.env` only |
| `AZURE_CHAT_KEY` | Azure OpenAI Chat API | Azure Portal | `.env` only |
| `AZURE_EMBEDDING_KEY` | Azure OpenAI Embeddings | Azure Portal | `.env` only |

### Secret Generation

**JWT Secret Key** (32+ bytes recommended):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Example output:
```
d5-ZyfxrfzcWO25eQ7yd6qNvRiT_hRG_TO7u3DUA3H4
```

### Security Requirements

1. **Never hardcode secrets**:
   - ❌ `SECRET_KEY = "my-secret-key"`
   - ✅ `SECRET_KEY = settings.SECRET_KEY` (from `.env`)

2. **Never commit secrets to git**:
   - Add `.env` to `.gitignore`
   - Use `.env.example` with placeholder values
   - Document required variables without actual values

3. **Fail securely**:
   - Application **crashes on startup** if `SECRET_KEY` missing
   - No fallback to default/hardcoded keys
   - Better to fail than run insecurely

4. **Rotate secrets regularly**:
   - Change `SECRET_KEY` invalidates all existing JWTs
   - Coordinate key rotation with user notification
   - Store old keys temporarily for graceful transition

5. **Never log secrets**:
   - Secrets never appear in logs, error messages, or responses
   - Use masked values in debug output

### Production Secret Management

For production deployments, use dedicated secret management:

- **Azure Key Vault**: Integrate with Azure SDK
- **AWS Secrets Manager**: Use boto3 integration
- **HashiCorp Vault**: REST API or SDK
- **Environment variables**: Set at container/VM level (never in code)

---

## CORS Policy

### Current Configuration

CORS (Cross-Origin Resource Sharing) controls which domains can access the API:

```python
# Backend/Source/Main.py
cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,          # Specific origins only
    allow_credentials=True,              # Required for cookies
    allow_methods=["*"],                 # All methods allowed
    allow_headers=["*"],                 # All headers allowed
    expose_headers=["*"]                 # Expose response headers
)
```

### Environment Configuration

```env
# Development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Production
CORS_ORIGINS=https://qiyasai.example.com,https://www.qiyasai.example.com
```

### Security Considerations

1. **No wildcards**: Never use `allow_origins=["*"]` with `allow_credentials=True`
2. **Specific domains**: List exact domains (with protocol and port)
3. **Credentials required**: Cookies won't work without `allow_credentials=True`
4. **Production**: Update `CORS_ORIGINS` to production domain before deployment

### Common CORS Issues

**Problem**: Frontend can't send cookies
```
Access to fetch at 'http://localhost:8000/api/auth/token' from origin 'http://localhost:5173'
has been blocked by CORS policy: Response to preflight request doesn't pass access control check:
The value of the 'Access-Control-Allow-Credentials' header in the response is 'false'
```

**Solution**: Ensure:
- `allow_credentials=True` in backend
- `axios.defaults.withCredentials = true` in frontend
- Frontend origin in `CORS_ORIGINS`

---

## Vulnerability Mitigation

### OWASP Top 10 Coverage

| Vulnerability | Mitigation | Implementation |
|---------------|------------|----------------|
| **A01: Broken Access Control** | JWT authentication on all protected endpoints | `Depends(get_current_user)` on routes |
| **A02: Cryptographic Failures** | Bcrypt password hashing, httpOnly cookies | `get_password_hash()`, cookie security flags |
| **A03: Injection** | Parameterized queries, input validation | SQLAlchemy ORM, Pydantic validation |
| **A04: Insecure Design** | CSRF protection, rate limiting | CSRF tokens, slowapi rate limits |
| **A05: Security Misconfiguration** | Fail-secure defaults, no debug in prod | Required SECRET_KEY, LOG_LEVEL=ERROR |
| **A06: Vulnerable Components** | Dependency scanning, pinned versions | `requirements.txt` with versions |
| **A07: Auth Failures** | Bcrypt work factor 12, rate limited login | `bcrypt.hashpw()`, 5 attempts/min |
| **A08: Data Integrity** | CSRF tokens, signed JWTs | JWT signatures, CSRF validation |
| **A09: Logging Failures** | Structured audit logs, security events | JSON logs, all auth attempts logged |
| **A10: SSRF** | No user-controlled URLs in requests | N/A (no external URL fetching) |

### Specific Attack Mitigations

#### XSS (Cross-Site Scripting)
- **httpOnly cookies**: JWT inaccessible to JavaScript
- **Content Security Policy**: Can be added via middleware
- **Output encoding**: React automatically escapes JSX content
- **Sanitization**: User input validated via Pydantic

#### SQL Injection
- **SQLAlchemy ORM**: Parameterized queries by default
- **No raw SQL**: All queries use ORM methods
- **Input validation**: Pydantic models validate types

#### Path Traversal
- **Filename sanitization**: Removes `../`, `..\\`, `/`, `\`
- **Basename only**: `os.path.basename()` strips paths
- **Safe paths**: All file operations use sanitized names

#### CSRF
- **Double Submit**: Token in header + cookie validation
- **SameSite cookies**: `samesite=lax` prevents cross-site sends
- **State-changing only**: GET requests exempt from CSRF

#### Brute Force
- **Rate limiting**: 5 login attempts/minute per IP
- **Bcrypt**: Slow hashing (work factor 12)
- **Account lockout**: Can be added (not currently implemented)

#### Session Hijacking
- **httpOnly + Secure**: Cookie theft via XSS prevented
- **Short expiry**: 24-hour token lifetime
- **No token in URL**: JWT only in cookie (not query params)

#### File Upload Attacks
- **MIME validation**: Magic number verification
- **Size limits**: 50MB max
- **Extension whitelist**: Only safe file types
- **Path sanitization**: No directory traversal

---

## Security Testing

### Manual Testing Checklist

#### Authentication Testing
```bash
# Test 1: Login with valid credentials
curl -X POST http://localhost:8000/api/auth/token \
  -F "username=Qiyas" \
  -F "password=1208" \
  -v  # Verify Set-Cookie header

# Test 2: Login with invalid credentials
curl -X POST http://localhost:8000/api/auth/token \
  -F "username=admin" \
  -F "password=wrong" \
  -v  # Expect 401

# Test 3: Access protected endpoint without cookie
curl http://localhost:8000/api/auth/me \
  -v  # Expect 401

# Test 4: Rate limit - login 6 times rapidly
for i in {1..6}; do
  curl -X POST http://localhost:8000/api/auth/token \
    -F "username=admin" -F "password=wrong"
done
# 6th attempt should return 429
```

#### CSRF Testing
```bash
# Test 1: POST without CSRF token
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -F "file=@test.pdf" \
  -v  # Expect 403

# Test 2: POST with invalid CSRF token
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -H "X-CSRF-Token: invalid-token" \
  -F "file=@test.pdf" \
  -v  # Expect 403
```

#### File Upload Testing
```bash
# Test 1: Upload valid PDF
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -H "X-CSRF-Token: ..." \
  -F "file=@document.pdf" \
  -v  # Expect 200

# Test 2: Upload .exe renamed to .pdf
mv malware.exe malware.pdf
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -H "X-CSRF-Token: ..." \
  -F "file=@malware.pdf" \
  -v  # Expect 400 (MIME check fails)

# Test 3: Upload oversized file
dd if=/dev/zero of=large.pdf bs=1M count=60  # 60MB
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -H "X-CSRF-Token: ..." \
  -F "file=@large.pdf" \
  -v  # Expect 400 (size check fails)

# Test 4: Path traversal attempt
curl -X POST http://localhost:8000/api/controls/upload \
  --cookie "access_token=..." \
  -H "X-CSRF-Token: ..." \
  -F "file=@../../etc/passwd;filename=../../../etc/passwd.pdf" \
  -v  # Filename should be sanitized
```

### Automated Security Scanning

#### OWASP ZAP (Zed Attack Proxy)
```bash
# Install ZAP
# https://www.zaproxy.org/download/

# Run baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:8000 \
  -r zap_report.html
```

#### Bandit (Python Security Linter)
```bash
# Install
pip install bandit

# Scan codebase
bandit -r Backend/Source/ -f json -o security_report.json
```

#### Safety (Dependency Vulnerability Scanner)
```bash
# Install
pip install safety

# Check dependencies
safety check --file Backend/requirements.txt
```

### Penetration Testing Scenarios

1. **Brute Force Login**: Attempt 100 login requests/minute
2. **Session Hijacking**: Steal cookie via XSS (should fail - httpOnly)
3. **CSRF Attack**: Trick user into making request from malicious site (should fail - CSRF token)
4. **File Upload Malware**: Upload various malware types renamed as PDFs (should fail - MIME check)
5. **SQL Injection**: Insert SQL in all input fields (should fail - ORM parameterization)
6. **Path Traversal**: Attempt to access `/etc/passwd` via file upload (should fail - sanitization)

---

## Incident Response

### Incident Classification

| Severity | Examples | Response Time |
|----------|----------|---------------|
| **Critical** | Secret key leaked, RCE vulnerability, database breach | Immediate (< 1 hour) |
| **High** | Authentication bypass, XSS vulnerability, privilege escalation | Same day (< 8 hours) |
| **Medium** | CSRF protection failure, information disclosure, rate limit bypass | Next day (< 24 hours) |
| **Low** | Verbose error messages, minor information leakage | Next sprint |

### Response Procedures

#### 1. Secret Key Compromise

**Detection**:
- Secret key found in public repository
- Secret key appears in logs
- Unauthorized JWT tokens validated successfully

**Immediate Actions**:
1. **Rotate secret immediately**:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   # Update SECRET_KEY in .env
   ```
2. **Restart all backend instances** (invalidates all existing tokens)
3. **Force re-authentication** for all users
4. **Review logs** for suspicious activity during compromise window
5. **Notify users** of security incident

**Prevention**:
- Never commit `.env` files
- Use `.gitignore` for secrets
- Enable secret scanning (GitHub, GitLab)
- Regular secret rotation (quarterly)

#### 2. Authentication Bypass

**Detection**:
- User accessing protected resources without authentication
- JWT validation bypassed
- Logs show authenticated actions without login

**Immediate Actions**:
1. **Identify bypass method** (logs, stack trace)
2. **Disable affected endpoint** temporarily
3. **Deploy hotfix** for vulnerability
4. **Review all authentication code**
5. **Check for unauthorized data access** in audit logs

#### 3. File Upload Malware

**Detection**:
- Malware uploaded despite validation
- Antivirus alerts on server
- Unusual file processing errors

**Immediate Actions**:
1. **Quarantine uploaded file** (move to secure location)
2. **Scan server** for malware spread
3. **Review file validation logic**
4. **Check all uploaded files** for similar patterns
5. **Enhance MIME validation** if needed

#### 4. Rate Limit Bypass

**Detection**:
- Excessive requests from single IP
- Rate limit not triggering
- Logs show > limit requests

**Immediate Actions**:
1. **Block attacking IP** at firewall level
2. **Review rate limit configuration**
3. **Check for distributed attack** (multiple IPs)
4. **Deploy fix** for bypass method
5. **Consider Cloudflare/WAF** for DDoS protection

### Log Analysis Commands

```bash
# Find failed login attempts
grep '"level":"WARNING"' logs/qiyasai.log | grep "Failed login"

# Find rate limit violations
grep '"level":"WARNING"' logs/qiyasai.log | grep "Rate limit exceeded"

# Find file upload errors
grep '"level":"ERROR"' logs/qiyasai.log | grep "File processing error"

# Find CSRF validation failures
grep '"level":"WARNING"' logs/qiyasai.log | grep "Invalid CSRF token"

# Track specific user activity
grep '"user_id":123' logs/qiyasai.log

# Track specific request
grep '"request_id":"a1b2c3d4-..."' logs/qiyasai.log
```

### Post-Incident Review

After resolving incident:

1. **Root Cause Analysis**: Document how vulnerability existed
2. **Timeline**: Record detection, response, resolution times
3. **Lessons Learned**: What went well, what needs improvement
4. **Process Updates**: Update security procedures, testing
5. **Code Review**: Review related code for similar issues
6. **User Communication**: Notify affected users if data exposed

---

## Production Security Checklist

### Pre-Deployment

- [ ] **Generate production SECRET_KEY**
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

- [ ] **Set secure cookie configuration**
  ```env
  COOKIE_SECURE=true
  COOKIE_SAMESITE=strict
  COOKIE_DOMAIN=qiyasai.example.com
  ```

- [ ] **Update CORS to production domain**
  ```env
  CORS_ORIGINS=https://qiyasai.example.com
  ```

- [ ] **Set production log level**
  ```env
  LOG_LEVEL=WARNING
  LOG_FORMAT=json
  ```

- [ ] **Enable Redis for rate limiting**
  ```python
  # Update Backend/Source/Middleware/RateLimiting.py
  limiter = Limiter(
      key_func=get_identifier,
      storage_uri="redis://localhost:6379"
  )
  ```

- [ ] **Change default user password**
  ```python
  # Update AuthService.py or change via API after deployment
  ```

- [ ] **Set file size limits appropriately**
  ```env
  MAX_FILE_SIZE_GENERAL=52428800  # 50MB
  MAX_FILE_SIZE_CHAT=26214400     # 25MB
  ```

- [ ] **Configure log aggregation**
  - Set up ELK Stack, Datadog, or CloudWatch
  - Configure log shipping from `logs/qiyasai.log`

- [ ] **Set up secret management**
  - Use Azure Key Vault, AWS Secrets Manager, or similar
  - Remove secrets from `.env`, load from vault

### Infrastructure

- [ ] **Enable HTTPS/TLS**
  - Obtain SSL certificate (Let's Encrypt, etc.)
  - Configure reverse proxy (nginx, Apache)
  - Enforce HTTPS redirect

- [ ] **Configure firewall**
  - Allow only ports 80, 443
  - Block direct access to port 8000 (backend)
  - Whitelist trusted IPs for admin access

- [ ] **Set up monitoring**
  - Uptime monitoring (Pingdom, UptimeRobot)
  - Resource monitoring (CPU, memory, disk)
  - Log monitoring for security events

- [ ] **Configure backups**
  - Database backups (daily, encrypted)
  - Log backups (retention policy)
  - Configuration backups (`.env`, settings)

- [ ] **DDoS protection**
  - Use Cloudflare or AWS Shield
  - Configure rate limiting at CDN level
  - Set up IP reputation filtering

### Security Hardening

- [ ] **Disable debug mode**
  ```python
  # main.py
  uvicorn.run(..., reload=False, access_log=False)
  ```

- [ ] **Remove development tools**
  ```bash
  pip uninstall pytest pytest-asyncio httpx
  ```

- [ ] **Run security scans**
  ```bash
  bandit -r Backend/Source/
  safety check
  ```

- [ ] **Update dependencies**
  ```bash
  pip list --outdated
  pip install --upgrade <package>
  ```

- [ ] **Configure Content Security Policy**
  ```python
  # Add CSP middleware
  response.headers["Content-Security-Policy"] = "default-src 'self'"
  ```

- [ ] **Enable HSTS**
  ```python
  response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
  ```

### Monitoring & Alerting

- [ ] **Set up alerts**
  - Failed login spike (> 10/min)
  - Rate limit violations (> 100/hour)
  - Error rate spike (> 5% of requests)
  - Disk space low (< 10% free)

- [ ] **Log retention**
  - Production logs: 90 days
  - Security logs: 1 year
  - Audit logs: 7 years (if regulated)

- [ ] **Security dashboard**
  - Failed authentication attempts
  - Rate limit violations
  - File upload rejections
  - API error rates

### Compliance & Documentation

- [ ] **Document security controls**
  - Update SECURITY.md
  - Maintain change log
  - Document incident response procedures

- [ ] **User privacy**
  - Document data collection (privacy policy)
  - Implement data deletion (GDPR compliance)
  - User consent for cookies

- [ ] **Penetration testing**
  - Schedule annual pen test
  - Third-party security audit
  - Vulnerability disclosure program

### Post-Deployment

- [ ] **Verify security settings**
  ```bash
  # Check HTTPS enforced
  curl http://qiyasai.example.com
  # Should redirect to https://

  # Check security headers
  curl -I https://qiyasai.example.com
  # Verify HSTS, CSP, etc.

  # Test rate limiting
  for i in {1..10}; do
    curl -X POST https://qiyasai.example.com/api/auth/token \
      -F "username=test" -F "password=wrong"
  done
  # Should get 429 after 5 attempts
  ```

- [ ] **Monitor logs for 24 hours**
  - Watch for errors
  - Check authentication success rate
  - Verify no security warnings

- [ ] **Test incident response**
  - Simulate secret leak
  - Simulate DDoS attack
  - Verify alerting works

---

## Security Contact

For security vulnerabilities, please contact:

- **Email**: security@example.com
- **PGP Key**: [Link to public key]
- **Response Time**: Within 24 hours

**Please do not**:
- Open public issues for security vulnerabilities
- Discuss vulnerabilities in public forums
- Attempt to exploit vulnerabilities in production

**Responsible Disclosure**:
We appreciate responsible disclosure and will credit researchers who report vulnerabilities privately. We aim to patch critical vulnerabilities within 48 hours and high-severity issues within 7 days.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-22 | 1.0 | Initial security implementation: httpOnly cookies, CSRF, rate limiting, file validation, structured logging |

---

**Last Updated**: 2025-01-22
**Document Owner**: Development Team
**Review Cycle**: Quarterly
