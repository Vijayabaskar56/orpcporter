# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**OpenAPI Documentation Sources:**
- Direct OpenAPI/Swagger JSON/YAML files - Fetched via native `fetch()` API
  - SDK/Client: Native Web Fetch API (built into Bun)
  - Auth: None required for spec fetching
  - User-Agent: "orpcport/1.0"
- Scalar API Reference pages - HTML parsing for embedded specs
- Swagger UI pages - HTML/JavaScript parsing for embedded specs
- Redoc documentation pages - HTML parsing for embedded specs

**HTTP Client (Generated CLIs):**
- RESTful API endpoints - HTTP client in `src/runtime/http.ts`
  - SDK/Client: Native `fetch()` API
  - Auth: Configurable (Bearer, API Key, Basic)
  - Security: Blocks private IPs, warns on HTTP, requires HTTPS for credentials

## Data Storage

**Databases:**
- None - This is a CLI generator tool, not a service

**File Storage:**
- Local filesystem only
  - User configs: `~/.config/<cli-name>/config.json` (0o600 permissions)
  - Generated binaries: Output to user-specified directory
  - Man pages: Generated as `.1` files alongside binaries
  - Temp files: Created in OS temp directory during compilation

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- Custom implementation in `src/runtime/http.ts`
  - Implementation: Three auth types supported:
    1. Bearer token - `Authorization: Bearer <token>` header
    2. API Key - Configurable header name (default: `X-API-Key`)
    3. Basic auth - `Authorization: Basic <base64(user:pass)>` header
  - Storage: Credentials stored in `~/.config/<cli-name>/config.json` (0o600 permissions)
  - Security: Refuses to send credentials over HTTP unless `allowInsecure` option enabled

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to console only

**Logs:**
- Console output only
  - `console.log()` for success messages
  - `console.error()` for errors and warnings
  - `console.error()` warnings for insecure HTTP connections

## CI/CD & Deployment

**Hosting:**
- Not applicable - CLI tool distributed as compiled binaries

**CI Pipeline:**
- None detected in repository

## Environment Configuration

**Required env vars:**
- `HOME` - Used for config directory location (`~/.config/`)
  - Fallback: `~` literal if `HOME` undefined
  - Location: `src/runtime/config.ts` line 15

**Secrets location:**
- User config files: `~/.config/<cli-name>/config.json`
  - Permissions: 0o600 (owner read/write only)
  - Directory permissions: 0o700 (owner read/write/execute only)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Security Features

**Request Safety:**
- Private IP blocking - `src/runtime/http.ts` blocks requests to:
  - localhost, 127.x.x.x
  - 10.x.x.x
  - 172.16-31.x.x
  - 192.168.x.x
  - 169.254.x.x (link-local)
  - IPv6 localhost and private ranges
- HTTP warning/blocking - Warns on HTTP, blocks credentials over HTTP unless `allowInsecure` enabled
- Path traversal prevention - Validates CLI names and output paths in `index.ts`

**Config Security:**
- Key validation - Prevents prototype pollution via `__proto__`, `constructor`, `prototype` keys
- Permission restrictions - Config files set to 0o600, directories to 0o700
- Input sanitization - CLI names validated with regex `^[a-zA-Z0-9_-]+$`

---

*Integration audit: 2026-02-20*
