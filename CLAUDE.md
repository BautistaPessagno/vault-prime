# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Monorepo with pnpm workspaces and Cargo workspace:

```
vault-prime/
├── apps/
│   ├── web/          # Next.js 16 web app (main app)
│   ├── desktop/      # Tauri desktop app (scaffold)
│   ├── mobile/       # Mobile app (scaffold)
│   └── extension/    # Browser extension (WXT + React, implemented)
├── packages/
│   └── vault-crypto/ # Rust crypto core library
├── bindings/         # Generated platform bindings (wasm, ios, android)
├── Cargo.toml        # Cargo workspace root
├── pnpm-workspace.yaml
└── package.json      # Workspace root with filter scripts
```

## Commands

### Development (from root)
```bash
pnpm dev          # Start web dev server on localhost:3000
pnpm build        # Build web app for production
pnpm start        # Start web production server
pnpm lint         # Run ESLint on web app
```

### Development (from apps/web/)
```bash
cd apps/web
pnpm dev          # Start development server on localhost:3000
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
```

### Database (from apps/web/)
```bash
cd apps/web
pnpm db:push      # Push schema changes to database
pnpm db:generate  # Generate migration files
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio (database GUI)
```

### Rust (from root)
```bash
cargo build -p vault-crypto              # Build crypto library
cargo run -p vault-crypto --bin vault-crypto-cli  # Run CLI binary
cargo test -p vault-crypto               # Run tests
```

There are no test files and no CI/CD configuration in this repo.

## Architecture

### Encryption & Security Model

This project implements a **zero-knowledge password vault**. Per OWASP A02 and the Bitwarden security model: the server must never see the master password, the derived encryption key, or plaintext vault data — only the KDF output hash for auth verification and encrypted ciphertext blobs.

1. **Master Password Hash** (`apps/web/src/lib/auth/encryption.ts`):
   - User's master password is hashed with Argon2id (64 MiB memory cost, well above OWASP minimum of 19 MiB)
   - Email is used as salt for deterministic hash generation
   - The hash is stored in `users.master_password_hash` — only used for auth verification

2. **Encryption Key Derivation**:
   - Master password hash + password → HKDF-SHA256 → 32-byte encryption key
   - This derived key encrypts all vault entries using AES-256-GCM
   - Key is **never stored in database** — only in short-lived cache (web) or browser.storage.session (extension)

3. **Cache-Based Key Storage** (`apps/web/src/lib/cache/`):
   - globalThis-based in-memory cache (survives hot reloads)
   - TTL: 15 minutes (configurable via `KEY_CACHE_TTL`), auto-cleanup every 60s, FIFO eviction on max entries
   - Session ID in JWT links to the cached encryption key
   - Same cache used for rate limiting counters

4. **Entry Encryption** (`apps/web/src/lib/entries/crypto.ts`):
   - Each field (name, username, password, url) is encrypted separately using AES-256-GCM
   - Format: `{nonce_hex}:{ciphertext_hex}` — fresh 24-byte random nonce per field per operation
   - Never reuse nonces under the same key — the per-field random nonce approach is correct

### Rust Crypto Core (`packages/vault-crypto/`)

Shared Rust library providing crypto primitives for all platforms:
- `src/crypto.rs` — Argon2id hashing, HKDF key derivation, AES-256-GCM encrypt/decrypt
- `src/lib.rs` — Module declarations and re-exports
- `src/wasm.rs` — WASM bindings scaffold (feature-gated: `wasm`)
- `src/ffi.rs` — Mobile FFI scaffold (feature-gated: `mobile`)
- `src/main.rs` — CLI binary for testing

### Authentication Flow

1. **Login** (`apps/web/src/app/api/auth/login/route.ts`):
   - Hash password with email as salt → master key
   - Verify master key against stored `master_password_hash`
   - Check account lockout status before allowing login
   - Derive encryption key from master key
   - Generate session ID and store encryption key in cache
   - Issue JWT with `sub` (user ID), `email`, and `sid` (session ID) — HS256 via `jose`
   - JWT expires in 15 minutes, matching cache TTL
   - On user-not-found, runs a dummy Argon2 hash to normalize timing

2. **Session Validation** (`apps/web/src/lib/entries/crypto.ts:getSessionData()`):
   - Extract JWT from `session` cookie
   - Verify JWT signature and expiration
   - Retrieve encryption key from cache using session ID
   - If key missing, user must re-login (no refresh tokens — by design)

3. **Email Verification** (`apps/web/src/lib/auth/verification.ts`):
   - 6-digit code generated from 32 random bytes, SHA-256 hashed before storage
   - Codes expire after 15 minutes, max 3 verification attempts per code
   - Sent via Resend (`apps/web/src/lib/email/send-verification-email.ts`)
   - Users must verify email before full access

4. **Account Lockout** (`apps/web/src/lib/security/lockout.ts`):
   - 5 failed login attempts → 30-minute lockout
   - Lockout stored in `users.locked_until` column
   - Auto-clears after lockout period expires

5. **Password Validation** (`apps/web/src/lib/security/password-validation.ts`):
   - Minimum 12 characters + zxcvbn score >= 3 (strong)

### Security Layer

#### Rate Limiting (`apps/web/src/lib/security/rate-limit.ts`)
Cache-based sliding window rate limiter. Current limits:
- **Signup**: 5/15min per IP
- **Login**: 10/15min per IP + 5/15min per email
- **Change Password**: 5/15min per user
- **Verify Email**: 10/15min per IP
- **Resend Verification**: 3/15min per IP + 5/15min per email
- **Entry writes** (create/update/delete/copy): 30/min per user
- **Extension Login**: 10/15min per IP + 5/15min per email

Anti-enumeration: `resend-verification` returns `{ ok: true }` even when rate-limited.

#### Audit Logging (`apps/web/src/lib/security/audit-log.ts`)
All security events logged to `audit_logs` table with IP and user-agent.

#### Input Validation (`apps/web/src/lib/validation/schemas.ts`)
Zod schemas for all inputs: `signupSchema`, `loginSchema`, `verifyEmailSchema`, `entrySchema`.

### Security Headers (`apps/web/next.config.ts`)

Applied to all routes via Next.js `headers()`:
- **HSTS**: 2 years with `includeSubDomains` and `preload`
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: camera, microphone, geolocation, payment all disabled

CSP headers (`frame-ancestors 'none'`, `form-action 'self'`) are set separately in middleware (`apps/web/src/lib/proxy.ts`).

### Proxy/Middleware (`apps/web/src/lib/proxy.ts`)

Authentication-based routing + CSP headers:

- **Public Routes**: `/login`, `/signup`, `/verify-email/*`
- **Protected Routes**: All other routes require valid JWT
- **Excluded Paths**: `/api/*`, `/_next/*`, static files
- **CSP**: Set on all non-excluded responses (frame-ancestors 'none', form-action 'self', etc.)
- Authenticated users on `/login` or `/signup` are redirected to `/`

### Browser Extension (`apps/extension/`)

Built with WXT (WebExtension framework) + React 19. Supports Firefox MV2 and Chrome MV3.

**Architecture — three components:**

1. **Background service worker** (`entrypoints/background.ts`):
   - State machine: `logged_out` → `locked` → `unlocked`
   - Stores JWT + AES-encrypted encryption key in `browser.storage.session`
   - On unlock: decrypts the stored encryption key into memory
   - Auto-lock via `browser.alarms` API (15-minute timeout)
   - Handles messages: `login`, `unlock`, `lock`, `logout`, `getEntries`, `getStatus`

2. **Content script** (`entrypoints/content.ts`):
   - Detects password fields on page load + DOM mutations (MutationObserver)
   - Injects autofill icon and dropdown UI (fixed-position, isolated from page styles)
   - Matches entries by hostname only (not full URL)
   - Auto-fills if single match; shows dropdown for multiple
   - HTML-escapes all dynamic content to prevent XSS

3. **Popup UI** (`entrypoints/popup/`):
   - React component tree: LoginPage → UnlockPage → VaultListPage → EntryDetailPage
   - Communicates with background via `browser.runtime.sendMessage`

**Extension key management differs from web:**
- No server-side cache — encryption key stored AES-encrypted in `browser.storage.session`
- Extension JWT has no `sid` claim (no server-side session lookup needed)
- Decrypted key held only in background worker memory, cleared on lock

**Cryptography**: `@noble/ciphers` + `@noble/hashes` (HKDF-SHA256 + AES-256-GCM, matching web implementation)

### Extension API Routes (`apps/web/src/app/api/extension/`)

Separate from the main web API. Use Bearer token auth (not cookies). All routes include open CORS headers (`Access-Control-Allow-Origin: *`) via `cors.ts`.

- **POST `/api/extension/login`** — Returns JWT (no `sid`), `encryptedEncryptionKey`, and `masterKeyHash` for offline unlock
- **GET `/api/extension/entries`** — Returns encrypted entries for the authenticated user

The extension decrypts all data locally; the server never receives plaintext.

### Database Schema (`apps/web/src/db/schema.ts`)

- **users**: `id`, `email`, `master_password_hash`, `created_at`, `verified_at`, `failed_login_attempts`, `locked_until`
- **entries**: `id`, `user_id` (cascade delete), `name`, `username`, `password`, `url`, `last_edited`, `last_copied`, `created_at`
- **email_verification_codes**: `id`, `user_id`, `code_hash`, `created_at`, `expires_at`, `attempts`
- **audit_logs**: `id`, `user_id` (set null on delete), `event_type`, `ip_address`, `user_agent`, `metadata`, `created_at`
- All entry fields except metadata are encrypted in database

### API Routes

All routes under `apps/web/src/app/api/`:
- **Auth**: `auth/signup`, `auth/login`, `auth/logout`, `auth/profile`, `auth/change-password`, `auth/verify-email`, `auth/resend-verification`
- **Entries**: `entries` (GET/POST), `entries/[id]` (GET/PUT/DELETE), `entries/[id]/copied` (POST)
- **Extension**: `extension/login` (POST), `extension/entries` (GET)

### Frontend Structure

- Next.js 16 App Router (`apps/web/src/app/`)
- Pages: root (`page.tsx`), `login`, `signup`, `verify-email` (+ `success`/`error` subpages), `settings`, `settings/password`
- Client-side encryption context: `encryption.tsx` provides master password to encrypt/decrypt entries locally

### Key Files

- `apps/web/src/lib/auth/encryption.ts` - Argon2, HKDF, AES-256-GCM primitives
- `apps/web/src/lib/auth/jwt.ts` - JWT signing/verification with HS256 (jose library)
- `apps/web/src/lib/auth/verification.ts` - Email verification code generation and validation
- `apps/web/src/lib/auth/verify-user.ts` - User verification status check
- `apps/web/src/lib/proxy.ts` - Authentication proxy, route protection, and CSP headers
- `apps/web/src/lib/cache/index.ts` - Cache abstraction layer (globalThis in-memory)
- `apps/web/src/lib/entries/crypto.ts` - Session validation and entry encryption helpers
- `apps/web/src/lib/security/rate-limit.ts` - Reusable rate limiter using cache
- `apps/web/src/lib/security/audit-log.ts` - Audit event logging with IP/UA extraction
- `apps/web/src/lib/security/lockout.ts` - Account lockout after failed logins
- `apps/web/src/lib/security/password-validation.ts` - zxcvbn-based password strength validation
- `apps/web/src/lib/validation/schemas.ts` - Zod schemas for all API inputs
- `apps/web/src/lib/email/send-verification-email.ts` - Resend integration for verification emails
- `apps/web/src/lib/pwned/passwords.ts` - HIBP pwned password check (stub, not yet implemented)
- `apps/web/src/app/api/extension/cors.ts` - CORS headers + withCors() wrapper for extension routes
- `apps/web/src/db/index.ts` - Drizzle database client
- `apps/web/drizzle.config.ts` - Database configuration using `POSTGRES_URL` env var
- `packages/vault-crypto/src/crypto.rs` - Rust crypto primitives (Argon2, HKDF, AES-256-GCM)

### Environment Variables

Required (in `apps/web/.env`):
- `POSTGRES_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing JWTs
- `JWT_ISSUER` - JWT issuer claim
- `JWT_AUDIENCE` - JWT audience claim

Optional:
- `KEY_CACHE_TTL` - Cache TTL in seconds (default: 900 = 15 minutes)
- `RESEND_API_KEY` - Resend API key for sending verification emails
- `RESEND_FROM` - Email sender address (default: `Vault Prime <no-reply@vault-prime.com>`)

Extension (in `apps/extension/.env`):
- `VITE_API_URL` - Web API base URL (default: `http://localhost:3000`)

## Important Notes

- **Never store encryption keys in database** — they only exist in cache (web) or browser.storage.session (extension)
- **Master password is never stored** — only Argon2id hash is persisted
- **Re-login required** when cache key expires (15 min default) — no refresh token flow by design
- **Extension decrypts locally** — the server never receives plaintext; extension JWT has no `sid`
- **Path alias**: `@/` maps to `apps/web/` root (see `apps/web/tsconfig.json`)
- **Email normalization**: Emails are trimmed and lowercased
- **Cascade deletion**: Deleting a user automatically deletes all their entries
- **Cookie sameSite**: All cookies use `"strict"`
- **Error sanitization**: Console errors use `error.message` only (no full objects)
- **npx drizzle-kit**: don't use anything related with this command without asking
- **Encryption best practices reference**: Bitwarden security whitepaper + OWASP Top 10 (A02, A07) — validate any crypto changes against these. Key invariants: unique nonce per AES-GCM operation, Argon2id ≥ 19 MiB memory, no key material in logs/DB, AES-GCM authenticated encryption only.
