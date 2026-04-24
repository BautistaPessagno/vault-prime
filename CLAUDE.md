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
│   └── extension/    # Browser extension (scaffold)
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

## Architecture

### Encryption & Security Model

This project implements a **zero-knowledge password vault** with multiple encryption layers:

1. **Master Password Hash** (`apps/web/src/lib/auth/encryption.ts`):
   - User's master password is hashed with Argon2id (64 MiB memory cost)
   - Email is used as salt for deterministic hash generation
   - The hash is stored in `users.master_password_hash`

2. **Encryption Key Derivation**:
   - Master password hash + password → HKDF-SHA256 → 32-byte encryption key
   - This derived key encrypts all vault entries using AES-256-GCM
   - Key is never stored in database, only in cache

3. **Cache-Based Key Storage** (`apps/web/src/lib/cache/`):
   - Encryption keys are cached using in-memory cache
   - TTL is 15 minutes (configurable via `KEY_CACHE_TTL`)
   - Session ID links JWT to cached encryption key
   - Also used for rate limiting counters

4. **Entry Encryption** (`apps/web/src/lib/entries/crypto.ts`):
   - Each field (name, username, password, url) is encrypted separately
   - Format: `{nonce}:{ciphertext}` where nonce is 12 random bytes (96-bit, AES-GCM standard per NIST SP 800-38D)
   - Fresh nonce generated per field for maximum security

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
   - Issue JWT with `sub` (user ID), `email`, and `sid` (session ID)
   - JWT expires in 15 minutes, matching cache TTL
   - On user-not-found, runs a dummy Argon2 hash to normalize timing

2. **Session Validation** (`apps/web/src/lib/entries/crypto.ts:getSessionData()`):
   - Extract JWT from `session` cookie
   - Verify JWT signature and expiration
   - Retrieve encryption key from cache using session ID
   - If key missing, user must re-login (key expired)

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

Anti-enumeration: `resend-verification` returns `{ ok: true }` even when rate-limited.

#### Audit Logging (`apps/web/src/lib/security/audit-log.ts`)
All security events logged to `audit_logs` table with IP and user-agent.

#### Input Validation (`apps/web/src/lib/validation/schemas.ts`)
Zod schemas for all inputs: `signupSchema`, `loginSchema`, `verifyEmailSchema`, `entrySchema`.

### Proxy/Middleware (`apps/web/src/lib/proxy.ts`)

Authentication-based routing + CSP headers:

- **Public Routes**: `/login`, `/signup`, `/verify-email/*`
- **Protected Routes**: All other routes require valid JWT
- **Excluded Paths**: `/api/*`, `/_next/*`, static files
- **CSP**: Set on all non-excluded responses (frame-ancestors 'none', form-action 'self', etc.)
- Authenticated users on `/login` or `/signup` are redirected to `/`

### Database Schema (`apps/web/src/db/schema.ts`)

- **users**: `id`, `email`, `master_password_hash`, `encryption_key`, `created_at`, `verified_at`, `failed_login_attempts`, `locked_until`
- **entries**: `id`, `user_id` (cascade delete), `name`, `user`, `password`, `url`, `updated_at`, `copied_at`, `created_at`
- **email_verification_codes**: `id`, `user_id`, `code_hash`, `created_at`, `expires_at`, `attempts`
- **audit_logs**: `id`, `user_id` (set null on delete), `event_type`, `ip_address`, `user_agent`, `metadata`, `created_at`
- All entry fields except metadata are encrypted in database

### API Routes

All routes under `apps/web/src/app/api/`:
- **Auth**: `auth/signup`, `auth/login`, `auth/logout`, `auth/profile`, `auth/change-password`, `auth/verify-email`, `auth/resend-verification`
- **Entries**: `entries` (GET/POST), `entries/[id]` (GET/PUT/DELETE), `entries/[id]/copied` (POST)

### Frontend Structure

- Next.js 16 App Router (`apps/web/src/app/`)
- Pages: root (`page.tsx`), `login`, `signup`, `verify-email` (+ `success`/`error` subpages), `settings`, `settings/password`
- Client-side encryption context: `encryption.tsx` provides master password to encrypt/decrypt entries locally

### Key Files

- `apps/web/src/lib/auth/encryption.ts` - Argon2, HKDF, AES-256-GCM primitives
- `apps/web/src/lib/auth/jwt.ts` - JWT signing/verification with HS256
- `apps/web/src/lib/auth/verification.ts` - Email verification code generation and validation
- `apps/web/src/lib/auth/verify-user.ts` - User verification status check
- `apps/web/src/lib/proxy.ts` - Authentication proxy, route protection, and CSP headers
- `apps/web/src/lib/cache/index.ts` - Cache abstraction layer (in-memory)
- `apps/web/src/lib/entries/crypto.ts` - Session validation and entry encryption helpers
- `apps/web/src/lib/security/rate-limit.ts` - Reusable rate limiter using cache
- `apps/web/src/lib/security/audit-log.ts` - Audit event logging with IP/UA extraction
- `apps/web/src/lib/security/lockout.ts` - Account lockout after failed logins
- `apps/web/src/lib/security/password-validation.ts` - zxcvbn-based password strength validation
- `apps/web/src/lib/validation/schemas.ts` - Zod schemas for all API inputs
- `apps/web/src/lib/email/send-verification-email.ts` - Resend integration for verification emails
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

## Important Notes

- **Never store encryption keys in database** - they only exist in cache
- **Master password is never stored** - only Argon2 hash is persisted
- **Re-login required** when cache key expires (15 min default)
- **Path alias**: `@/` maps to `apps/web/` root (see `apps/web/tsconfig.json`)
- **Email normalization**: Emails are trimmed and lowercased
- **Cascade deletion**: Deleting a user automatically deletes all their entries
- **Cookie sameSite**: All cookies use `"strict"`
- **Error sanitization**: Console errors use `error.message` only (no full objects)
- **npx drizzle-kit**: don't use anything related with this command without asking
