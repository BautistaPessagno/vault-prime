# Vault Prime Security Report

Date: 2026-04-26
Reviewer: Codex
Scope: `apps/web`, `apps/extension`, `packages/vault-crypto`, project configuration, dependency metadata
Review type: Source review with local verification. This was not a live penetration test.

## Executive Summary

Vault Prime has several strong security controls already in place: authenticated entry routes enforce record ownership, vault fields are encrypted at rest, password hashing uses Argon2id, cookies are HttpOnly with strict SameSite, CSP and HSTS headers are configured, API inputs are validated with Zod, and audit logging exists for important events.

However, the current implementation is not yet suitable for production use as a password manager. The highest-risk issue is architectural: the web app decrypts vault entries on the server and returns plaintext to the browser. This means the web backend is in the trust path for user secrets, which contradicts the stated zero-knowledge model. The extension also stores enough material to reduce the cost of offline password guessing if extension session storage is compromised. Dependency advisories currently include high-severity issues in `next` and `drizzle-orm`.

Overall security score: **52/100**

This score reflects solid baseline controls but major remaining risks for a credential vault. Fixing the key-management model, dependency advisories, and password-change policy would substantially improve the score.

## Scoring Rationale

| Area | Weight | Score | Notes |
| --- | ---: | ---: | --- |
| Access control | 20 | 15 | Entry ownership checks are present; API routes rely on per-route auth. |
| Cryptography and key management | 25 | 8 | Strong primitives, but server-side plaintext decryption breaks zero-knowledge. |
| Authentication and session management | 20 | 12 | Short-lived JWTs, lockout, and rate limits exist; token exposure and weak change-password policy remain. |
| Secure configuration and headers | 15 | 10 | CSP/HSTS/security headers exist; API responses are not covered by CSP middleware and deployment assumptions matter. |
| Dependency and supply-chain hygiene | 10 | 2 | `pnpm audit --prod` reports 12 vulnerabilities, including 3 high. |
| Logging, monitoring, and operations | 10 | 5 | Audit logs exist, but rate limiting and revocation use process-local memory. |

## Methodology

- Reviewed repository instructions in `AGENTS.md` and `CLAUDE.md`.
- Reviewed authentication, sessions, cookies, JWTs, email verification, account lockout, password validation, entry APIs, extension APIs, cache/rate limiting, CSP/security headers, database schema, and crypto primitives.
- Searched for common risky patterns: raw SQL, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, token handling, secret usage, environment files, URL handling, command execution, and storage of sensitive data.
- Ran local verification:
  - `pnpm lint`
  - `pnpm audit --prod`
  - `cargo test -p vault-crypto`
  - `cargo audit` was attempted but is not installed locally.
- Mapped findings to OWASP Top 10 2021 and OWASP API Security Top 10 2023.

Reference baselines:

- OWASP Top 10 2021: https://owasp.org/Top10/2021/
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/

## Findings

### VP-SEC-001: Web vault decryption happens on the server

Severity: **Critical**
OWASP: A02 Cryptographic Failures, A04 Insecure Design, API3 Broken Object Property Level Authorization
Status: Open

Evidence:

- `apps/web/src/lib/entries/crypto.ts:31` retrieves the cached encryption key for the current session.
- `apps/web/src/app/api/entries/route.ts:81` decrypts entry fields server-side before returning them.
- `apps/web/src/app/api/entries/[id]/route.ts:139` decrypts updated entries server-side before returning them.

Risk:

The web backend can see plaintext vault names, usernames, passwords, and URLs. A server compromise, server-side logging mistake, malicious dependency, debugger, memory disclosure, or API bug can expose vault contents. For a password manager, this is a core trust-model failure.

Recommendation:

Move web vault encryption and decryption fully client-side. The web API should store and return ciphertext only. The server should never receive the data encryption key or plaintext entry fields. A safer target model:

- User password stays in the browser.
- Browser derives a key locally.
- Server stores only the encrypted data encryption key and encrypted entry fields.
- API responses for entries contain ciphertext fields only.
- The browser decrypts entries after successful authentication/unlock.

Priority: Immediate.

### VP-SEC-002: Extension unlock stores material that reduces offline guessing cost

Severity: **High**
OWASP: A02 Cryptographic Failures, A07 Identification and Authentication Failures, API2 Broken Authentication
Status: Open

Evidence:

- `apps/web/src/app/api/extension/login/route.ts:216` returns `masterKeyHash`.
- `apps/extension/src/entrypoints/background.ts:91` stores `token`, `encryptedEncryptionKey`, `masterKeyHash`, and `email`.
- `apps/extension/src/entrypoints/background.ts:119` re-derives the wrapping key from stored `masterKeyHash` and entered password using HKDF.
- `apps/extension/src/lib/crypto.ts:10` uses HKDF-SHA256 for this derivation.

Risk:

If extension session storage is compromised, an attacker can attempt password guesses by running HKDF plus AES-GCM decrypt checks against the stored encrypted encryption key. That bypasses the Argon2id cost that should protect the master password during offline guessing.

Recommendation:

Do not store or return `masterKeyHash` as an unlock secret. Rework the extension flow so offline unlock still requires an expensive KDF:

- Prefer deriving the wrapping key locally with Argon2id from the user password and a stored per-user salt.
- Store only the encrypted DEK and non-secret KDF parameters.
- Avoid returning the Argon2 output from the server as reusable client-side material.
- Add tests proving extension unlock cannot be brute-forced without running the intended KDF.

Priority: Immediate.

### VP-SEC-003: Change-password route does not enforce strong password policy

Severity: **High**
OWASP: A07 Identification and Authentication Failures, A04 Insecure Design
Status: Open

Evidence:

- `apps/web/src/app/api/auth/change-password/route.ts:34` only checks that both fields are non-empty.
- `apps/web/src/components/settings/change-password-flow.tsx:30` only enforces 8 characters client-side.
- Signup uses a stronger policy through `validatePassword` in `apps/web/src/app/api/auth/signup/route.ts:142`.

Risk:

An authenticated user can change to a weak password via direct API call. Because the vault encryption model depends on the account password, weak replacement passwords materially reduce account and vault security.

Recommendation:

Apply the same server-side password policy used during signup:

- Minimum 12 characters.
- `zxcvbn` score at least 3.
- Include the user's email as user input to `zxcvbn`.
- Return generic validation errors without leaking sensitive state.
- Update the UI to match the server policy.

Priority: High.

### VP-SEC-004: Production dependencies have known advisories

Severity: **High**
OWASP: A06 Vulnerable and Outdated Components, A08 Software and Data Integrity Failures
Status: Open

Evidence:

`pnpm audit --prod` reported 12 vulnerabilities:

- 3 high
- 8 moderate
- 1 low

Key affected packages:

- `next@16.1.0` in `apps/web/package.json:24`
- `drizzle-orm@0.45.1` in `apps/web/package.json:28`

Notable advisories from the audit output:

- `next`: GHSA-h25m-26qc-wcjf, patched in `>=16.1.5`
- `next`: GHSA-q4gf-8mx6-v5v3, patched in `>=16.2.3`
- `drizzle-orm`: GHSA-gpj5-g38j-94v9, patched in `>=0.45.2`
- Additional moderate Next.js advisories patched in `>=16.1.7` or newer

Risk:

The vulnerable Next.js versions include denial-of-service and request handling issues. The Drizzle ORM advisory concerns SQL identifier escaping. Even where exploitability is route/config dependent, this is unacceptable for production credential storage.

Recommendation:

- Upgrade Next.js to the latest patched version compatible with the app, at minimum `>=16.2.3`.
- Upgrade Drizzle ORM to `>=0.45.2`.
- Re-run `pnpm audit --prod`.
- Re-run `pnpm lint` and `pnpm build`.
- Add dependency audit to CI.

Priority: High.

### VP-SEC-005: Process-local memory cache is not deployment-safe

Severity: **Medium**
OWASP: A04 Insecure Design, A05 Security Misconfiguration, API4 Unrestricted Resource Consumption
Status: Open

Evidence:

- `apps/web/src/lib/cache/memoryCache.ts:15` stores sessions, keys, and rate-limit counters in a process-local `Map`.
- `apps/web/src/lib/cache/index.ts:15` returns the global in-memory cache.
- `apps/web/src/app/api/auth/change-password/route.ts:139` attempts account-wide revocation through `deleteByPrefix`, but this only affects the current process.

Risk:

In multi-instance or serverless deployments, rate limits can be bypassed across instances, session liveness checks become inconsistent, and password-change revocation may not invalidate sessions on other processes. This can lead to brute-force exposure, inconsistent logout behavior, and stale extension/web sessions.

Recommendation:

Use a shared, atomic store for cache and rate limiting, such as Redis, Upstash Redis, or a managed KV with compare/increment semantics:

- Store session liveness and key material centrally.
- Use atomic increments for rate limiting.
- Implement account-wide session revocation with a per-user session version or centralized session set.
- Ensure encrypted key material has TTL and is removed on logout/password change.

Priority: Medium.

### VP-SEC-006: Rate limiting trusts spoofable client IP headers

Severity: **Medium**
OWASP: A05 Security Misconfiguration, A09 Security Logging and Monitoring Failures, API4 Unrestricted Resource Consumption
Status: Open

Evidence:

- `apps/web/src/lib/security/audit-log.ts:48` reads `x-forwarded-for`.
- `apps/web/src/lib/security/audit-log.ts:54` reads `x-real-ip`.
- `apps/web/src/lib/security/audit-log.ts:60` reads `x-vercel-forwarded-for`.

Risk:

If the deployment platform does not overwrite these headers at the edge, an attacker can spoof them to bypass IP rate limits or poison audit logs. This weakens protections on login, signup, verification, and resend routes.

Recommendation:

- Trust only headers guaranteed by the hosting provider.
- Prefer provider-specific trusted headers over generic `x-forwarded-for`.
- Strip untrusted forwarding headers at the edge.
- Record both trusted client IP and raw proxy metadata only when safe.

Priority: Medium.

### VP-SEC-007: Web auth routes return session JWTs in JSON responses

Severity: **Medium**
OWASP: A02 Cryptographic Failures, A07 Identification and Authentication Failures
Status: Open

Evidence:

- `apps/web/src/app/api/auth/login/route.ts:77` returns `{ ok: true, token }` for JSON clients.
- `apps/web/src/app/api/auth/signup/route.ts:78` returns `{ ok: true, emailSent, token }` for JSON clients.
- The cookie is already set as HttpOnly on the same responses.

Risk:

Returning the JWT in the JSON body exposes it to JavaScript and increases impact from XSS, browser extensions, debug logs, and client-side error reporting. The web UI does not need the token because the HttpOnly cookie is the session transport.

Recommendation:

- Return `{ ok: true }` for web login/signup JSON responses.
- Keep the JWT only in the HttpOnly cookie for web sessions.
- Keep bearer-token responses isolated to the extension-specific API if required.
- Add `Cache-Control: no-store` on auth responses that set cookies.

Priority: Medium.

### VP-SEC-008: Signup endpoint allows account enumeration

Severity: **Low to Medium**
OWASP: A01 Broken Access Control, A04 Insecure Design, A07 Identification and Authentication Failures
Status: Open

Evidence:

- `apps/web/src/app/api/auth/signup/route.ts:173` detects existing users.
- `apps/web/src/app/api/auth/signup/route.ts:180` returns an `exists` error with HTTP 409.

Risk:

Attackers can determine whether an email has a Vault Prime account. For a password manager, account existence can be sensitive.

Recommendation:

Use a generic response such as "If this email can continue, we sent instructions" and move disambiguation to email. At minimum, rate-limit and monitor enumeration behavior.

Priority: Low to Medium.

### VP-SEC-009: Content Security Policy does not cover API routes

Severity: **Low**
OWASP: A05 Security Misconfiguration
Status: Open

Evidence:

- `apps/web/middleware.ts:7` excludes `/api`.
- `apps/web/src/lib/proxy.ts:34` also skips API paths.
- CSP is set in `apps/web/src/lib/proxy.ts:94` for non-excluded paths.
- General security headers are configured globally in `apps/web/next.config.ts:34`.

Risk:

API JSON responses do not need CSP for normal operation, but relying on middleware-only CSP creates split security behavior. If any API route ever returns HTML, redirects to HTML, or exposes browser-rendered content, it may not receive the same hardening.

Recommendation:

Keep global security headers in `next.config.ts`, and consider adding defensive `X-Content-Type-Options`, `Cache-Control`, and content-type correctness checks on all sensitive API responses. CSP on JSON APIs is optional but should be deliberate.

Priority: Low.

### VP-SEC-010: Lint is failing

Severity: **Low**
OWASP: A05 Security Misconfiguration, A08 Software and Data Integrity Failures
Status: Open

Evidence:

`pnpm lint` failed with:

- `apps/web/src/app/verify-email/page.tsx:207` unescaped apostrophe.
- `apps/web/src/components/email/verify-email-template.tsx:53` unescaped apostrophe.
- Several warnings, including unused imports and hook dependency warnings.

Risk:

The current lint failure blocks clean CI enforcement and can hide future security-relevant issues.

Recommendation:

Fix the lint errors and keep lint required in CI.

Priority: Low.

## Positive Security Controls

- Entry APIs enforce ownership with `user_id` conditions on reads, updates, deletes, and copy tracking.
- Entry IDs and user IDs are UUIDs.
- Password hashing uses Argon2id with a 64 MiB memory cost in the web auth path.
- Entry field encryption uses AES-256-GCM with a fresh random 96-bit nonce per field.
- JWTs are short-lived at 15 minutes and include issuer/audience verification.
- Cookies are HttpOnly and `sameSite: "strict"`.
- Login has IP and email rate limits.
- Account lockout exists after repeated failed login attempts.
- Email verification codes are hashed before storage, expire after 15 minutes, and have max attempts.
- Sensitive API responses for entries use `Cache-Control: no-store`.
- SQL access mostly uses Drizzle query builder APIs and parameterized expressions.
- `.env*` files are ignored, and `apps/web/.env` is not tracked.
- CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` are configured.

## OWASP Mapping Summary

| OWASP Category | Current Risk |
| --- | --- |
| A01 Broken Access Control | Mostly controlled for entries; signup enumeration remains. |
| A02 Cryptographic Failures | High risk due to server-side web decryption and extension unlock design. |
| A03 Injection | Low observed risk; Drizzle is used, but dependency advisory must be fixed. |
| A04 Insecure Design | High risk from zero-knowledge design gap and process-local revocation/rate limiting. |
| A05 Security Misconfiguration | Medium risk from trusted IP assumptions and inconsistent header coverage. |
| A06 Vulnerable and Outdated Components | High risk due to current audit results. |
| A07 Identification and Authentication Failures | Medium to high risk from weak change-password policy and token exposure. |
| A08 Software and Data Integrity Failures | Medium risk from dependency advisories and failing lint gate. |
| A09 Security Logging and Monitoring Failures | Medium risk from spoofable audit IP attribution. |
| A10 SSRF | Low observed risk; URL fields are validated to HTTP/HTTPS and not fetched server-side. |

## API Security Top 10 2023 Mapping

| API Category | Current Risk |
| --- | --- |
| API1 Broken Object Level Authorization | Low observed risk for entries due to ownership checks. |
| API2 Broken Authentication | Medium risk from token exposure and extension unlock design. |
| API3 Broken Object Property Level Authorization | High risk because web APIs return plaintext sensitive properties. |
| API4 Unrestricted Resource Consumption | Medium risk due to process-local rate limiting. |
| API5 Broken Function Level Authorization | Low observed risk; no admin functions were found. |
| API6 Unrestricted Access to Sensitive Business Flows | Medium risk for signup/resend/login abuse if rate limiting is bypassed. |
| API7 SSRF | Low observed risk; no server-side URL fetching found. |
| API8 Security Misconfiguration | Medium risk from deployment/header/IP trust assumptions. |
| API9 Improper Inventory Management | Medium risk until extension and web auth flows are documented and tested as separate trust boundaries. |
| API10 Unsafe Consumption of APIs | Low to medium risk; Resend is used for email, dependency advisories should be monitored. |

## Verification Results

### `pnpm audit --prod`

Result: Failed with advisories.

Summary:

- 12 vulnerabilities found.
- Severity: 1 low, 8 moderate, 3 high.
- Highest-priority updates: `next`, `drizzle-orm`.

### `pnpm lint`

Result: Failed.

Summary:

- 2 errors.
- 6 warnings.

### `cargo test -p vault-crypto`

Result: Passed.

Summary:

- Rust package compiled successfully.
- 0 tests were executed, so this only verifies compilation and doctest discovery.

### `cargo audit`

Result: Not executed.

Reason:

- `cargo audit` is not installed in the local environment.

## Prioritized Remediation Plan

### Immediate

1. Redesign web vault APIs so the server never decrypts or returns plaintext entries.
2. Redesign extension unlock so stolen extension storage cannot bypass Argon2id during offline guessing.
3. Enforce signup-equivalent password strength in the change-password API.
4. Upgrade `next` and `drizzle-orm`, then rerun `pnpm audit --prod`.

### Next

5. Replace process-local cache/rate limiting with a shared atomic store.
6. Harden trusted client IP extraction for the actual deployment platform.
7. Stop returning web session JWTs in JSON responses.
8. Make signup responses resistant to account enumeration.

### Ongoing

9. Fix lint and require lint/build/audit in CI.
10. Add security tests for ownership checks, unverified-user API denial, weak password rejection, session revocation, and ciphertext-only vault responses.
11. Add dependency audit automation for npm and Rust.
12. Document the intended zero-knowledge threat model and verify each auth/vault flow against it.

## Suggested Security Test Coverage

- Unauthenticated users cannot access any entry endpoint.
- User A cannot read, update, delete, or copy-track User B's entry.
- Unverified users cannot read or write entries.
- Weak passwords are rejected during signup and password change.
- Password change invalidates all active web and extension sessions.
- Entry APIs return ciphertext only after the zero-knowledge redesign.
- Extension unlock requires the intended expensive KDF.
- Rate limits are enforced across multiple app instances.
- Auth JSON responses do not include session tokens for web clients.

## Limitations

- No live deployment was tested.
- No browser-based dynamic testing was performed.
- No database migration execution was performed.
- No secrets were inspected from `.env`.
- `cargo audit` was unavailable.
- Dependency advisories are current as of the `pnpm audit --prod` run on 2026-04-26.
