# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Reading Before Any Work

**Before writing any code in this app, you MUST:**

1. **Read the root CLAUDE.md** (`../../CLAUDE.md`) — it contains the full encryption model, auth flow, API routes, and database schema that the mobile app must integrate with.
2. **Read the Bitwarden Security White Paper** (https://bitwarden.com/help/bitwarden-security-white-paper/) — this is the reference architecture for our zero-knowledge vault design. All encryption, key derivation, and session management decisions must align with the patterns described there. Fetch and read it before implementing or modifying anything related to encryption, key management, authentication, or data storage.

## Current State

This app is a **scaffold** — `ios/` and `android/` contain only `.gitkeep` files. The `package.json` has no scripts or dependencies. Everything is to be built from scratch.

## Monorepo Context

This app lives at `apps/mobile/` inside a pnpm + Cargo workspace monorepo:

```
vault-prime/
├── apps/mobile/              # This app (scaffold)
├── apps/web/                 # Next.js web app (reference implementation)
├── packages/vault-crypto/    # Rust crypto core (Argon2id, HKDF, AES-256-GCM)
├── bindings/
│   ├── vault-crypto-ios/     # Generated iOS bindings (scaffold)
│   └── vault-crypto-android/ # Generated Android bindings (scaffold)
```

## Rust Crypto Integration

The mobile app must use `packages/vault-crypto/` for all cryptographic operations — **no reimplementing crypto in Swift/Kotlin**.

- Feature flag: `mobile` in `packages/vault-crypto/Cargo.toml` enables UniFFI bindings
- FFI scaffold: `packages/vault-crypto/src/ffi.rs` (currently a placeholder)
- Dependency: `uniffi = "0.29"` (optional, gated behind `mobile` feature)
- Generated bindings go in `bindings/vault-crypto-ios/` and `bindings/vault-crypto-android/`
- Build the Rust library: `cargo build -p vault-crypto --features mobile`

## Backend API

The mobile app communicates with the same backend as the web app. API routes are defined in `apps/web/src/app/api/`:

- **Auth**: `auth/signup`, `auth/login`, `auth/logout`, `auth/profile`, `auth/change-password`, `auth/verify-email`, `auth/resend-verification`
- **Entries**: `entries` (GET/POST), `entries/[id]` (GET/PUT/DELETE), `entries/[id]/copied` (POST)

Key difference from web: the mobile app cannot rely on HTTP-only cookies for session management. It will need token-based auth (the backend already issues JWTs).

## Encryption Model (must match web implementation)

Read `apps/web/src/lib/auth/encryption.ts` and `apps/web/src/lib/entries/crypto.ts` as the reference:

1. **Master password** → Argon2id hash (email as salt, 64 MiB memory cost)
2. **Encryption key** → HKDF-SHA256(master_hash + password) → 32-byte key
3. **Entry encryption** → AES-256-GCM per field, format: `{nonce}:{ciphertext}`
4. Encryption key is **never sent to or stored on the server**
5. The mobile app must perform all encrypt/decrypt operations **locally** via the Rust FFI

## Important Constraints

- **Never store the master password or encryption key in plaintext** on device — use platform secure storage (Keychain on iOS, EncryptedSharedPreferences / Keystore on Android)
- **Never reimplement crypto** — always use `vault-crypto` via UniFFI bindings
- **npx drizzle-kit**: don't use anything related with this command without asking
- The web app's `@/` path alias maps to `apps/web/` — not relevant here but avoid confusion when reading web code
