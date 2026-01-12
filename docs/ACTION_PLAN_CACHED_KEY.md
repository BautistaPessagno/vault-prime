# Action Plan: Cache-Based Encryption Key Storage

## Overview

Replace the current JWT-embedded encryption key storage with a secure server-side cache-based solution. This improves security by removing sensitive encryption keys from JWT tokens.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Current Flow:                                               │
│                                                             │
│ Login → Derive encryptionKey → Embed in JWT (ek claim)     │
│                     ↓                                       │
│ API Request → Extract JWT → Read ek from payload           │
│                     ↓                                       │
│ Encrypt/Decrypt entries using ek                           │
└─────────────────────────────────────────────────────────────┘
```

**Current Files:**
- `src/lib/auth/jwt.ts` - JWT signing/verification
- `src/lib/auth/encryption.ts` - Key derivation, AES-256-GCM encryption
- `src/lib/entries/crypto.ts` - Session data extraction, entry encryption
- `src/app/api/auth/login/route.ts` - Login with key derivation
- `src/app/api/auth/signup/route.ts` - Signup with key derivation

**Current JWT Payload:**
```typescript
{
  sub: userId,
  email: email,
  ek: encryptionKey  // ← 64-char hex string (256-bit key)
}
```

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ New Flow:                                                   │
│                                                             │
│ Login → Derive encryptionKey → Generate sessionId          │
│                     ↓                                       │
│ Store: cache[sessionId] = encryptionKey (TTL: 15min)       │
│                     ↓                                       │
│ JWT payload: { sub: userId, email, sid: sessionId }        │
│                                                             │
│ API Request → Extract JWT → Read sid → Lookup cache[sid]   │
│                     ↓                                       │
│ Encrypt/Decrypt entries using cached key                   │
└─────────────────────────────────────────────────────────────┘
```

**New JWT Payload:**
```typescript
{
  sub: userId,
  email: email,
  sid: sessionId  // ← UUID reference to cached key
}
```

---

## Implementation Steps

### Phase 1: Cache Infrastructure

#### Step 1.1: Create Cache Module
**File:** `src/lib/cache/keyCache.ts`

```typescript
// Interface for key cache operations
interface KeyCache {
  set(sessionId: string, encryptionKey: string, ttlSeconds: number): Promise<void>;
  get(sessionId: string): Promise<string | null>;
  delete(sessionId: string): Promise<void>;
  refresh(sessionId: string, ttlSeconds: number): Promise<boolean>;
}
```

**Options to consider:**
1. **In-memory Map** - Simple, works for single-instance deployments
2. **Redis** - Recommended for production, supports distributed deployments
3. **Vercel KV** - If using Vercel, integrates well with their platform

#### Step 1.2: Implement In-Memory Cache (Development/Fallback)
**File:** `src/lib/cache/memoryCache.ts`

Features:
- TTL-based expiration using `setTimeout` or lazy cleanup
- Maximum entries limit to prevent memory bloat
- Thread-safe operations

#### Step 1.3: Implement Redis Cache (Production)
**File:** `src/lib/cache/redisCache.ts`

Features:
- Connection pooling
- Automatic reconnection
- TTL via Redis EXPIRE command

#### Step 1.4: Cache Factory
**File:** `src/lib/cache/index.ts`

```typescript
// Select cache implementation based on environment
export function getKeyCache(): KeyCache {
  if (process.env.REDIS_URL) {
    return getRedisCache();
  }
  return getMemoryCache();
}
```

---

### Phase 2: Session ID Generation

#### Step 2.1: Create Session ID Generator
**File:** `src/lib/auth/session.ts`

```typescript
import { randomBytes, bytesToHex } from "@noble/hashes/utils.js";

export function generateSessionId(): string {
  // 32 bytes = 256 bits of entropy, hex-encoded to 64 chars
  return bytesToHex(randomBytes(32));
}
```

---

### Phase 3: Update Authentication Flow

#### Step 3.1: Modify Login Route
**File:** `src/app/api/auth/login/route.ts`

Changes:
```diff
- const token = await signSessionToken({
-   sub: String(user.id),
-   email,
-   ek: encryptionKey,
- });
+ const sessionId = generateSessionId();
+ await keyCache.set(sessionId, encryptionKey, 900); // 15 minutes
+ const token = await signSessionToken({
+   sub: String(user.id),
+   email,
+   sid: sessionId,
+ });
```

#### Step 3.2: Modify Signup Route
**File:** `src/app/api/auth/signup/route.ts`

Apply same changes as login route.

#### Step 3.3: Create/Update Logout Route
**File:** `src/app/api/auth/logout/route.ts`

```typescript
// On logout, delete the cached key
const sessionId = payload.sid;
await keyCache.delete(sessionId);
```

---

### Phase 4: Update Session Data Retrieval

#### Step 4.1: Modify crypto.ts
**File:** `src/lib/entries/crypto.ts`

Changes to `getSessionData()`:
```diff
  const payload = await verifySessionToken(token);
  const userId = payload.sub != null ? String(payload.sub) : null;
- const encryptionKey = typeof payload.ek === "string" ? payload.ek : null;
+ const sessionId = typeof payload.sid === "string" ? payload.sid : null;
+
+ if (!sessionId) {
+   console.log("[Auth] Session missing session ID - requires re-login");
+   return null;
+ }
+
+ const encryptionKey = await keyCache.get(sessionId);
+ if (!encryptionKey) {
+   console.log("[Auth] Session key expired - requires re-login");
+   return null;
+ }
```

---

### Phase 5: Session Refresh (Optional Enhancement)

#### Step 5.1: Sliding Window Expiration
**File:** `src/lib/entries/crypto.ts`

```typescript
// Refresh TTL on each successful access
await keyCache.refresh(sessionId, 900);
```

#### Step 5.2: Token Refresh Endpoint (Optional)
**File:** `src/app/api/auth/refresh/route.ts`

Allow refreshing both the JWT and cache TTL without full re-login.

---

### Phase 6: Environment Configuration

#### Step 6.1: Add Environment Variables
**File:** `.env.example`

```bash
# Cache Configuration
REDIS_URL=redis://localhost:6379  # Optional: for Redis cache
KEY_CACHE_TTL=900                 # Key TTL in seconds (default: 15 min)
```

#### Step 6.2: Update Configuration Loading
**File:** `src/lib/cache/config.ts`

```typescript
export const CACHE_CONFIG = {
  ttlSeconds: parseInt(process.env.KEY_CACHE_TTL || "900", 10),
  maxMemoryEntries: 10000,
};
```

---

### Phase 7: Testing

#### Step 7.1: Unit Tests for Cache
**File:** `src/lib/cache/__tests__/keyCache.test.ts`

Test cases:
- Key storage and retrieval
- TTL expiration
- Key deletion
- Cache miss handling
- Concurrent access

#### Step 7.2: Integration Tests
**File:** `src/app/api/auth/__tests__/login.test.ts`

Test cases:
- Login stores key in cache
- API requests retrieve key from cache
- Expired sessions require re-login
- Logout clears cached key

---

### Phase 8: Migration Strategy

#### Step 8.1: Backward Compatibility (Temporary)
During migration, support both old (`ek`) and new (`sid`) formats:

```typescript
// In getSessionData():
const encryptionKey = typeof payload.ek === "string"
  ? payload.ek  // Old format - direct key
  : await keyCache.get(payload.sid);  // New format - cached key
```

#### Step 8.2: Forced Re-login
After deployment, existing tokens with `ek` will still work temporarily.
Set a deadline to remove backward compatibility and force re-login.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/cache/keyCache.ts` | Create | Cache interface definition |
| `src/lib/cache/memoryCache.ts` | Create | In-memory cache implementation |
| `src/lib/cache/redisCache.ts` | Create | Redis cache implementation |
| `src/lib/cache/index.ts` | Create | Cache factory and exports |
| `src/lib/cache/config.ts` | Create | Cache configuration |
| `src/lib/auth/session.ts` | Create | Session ID generation |
| `src/app/api/auth/login/route.ts` | Modify | Store key in cache, use sid |
| `src/app/api/auth/signup/route.ts` | Modify | Store key in cache, use sid |
| `src/app/api/auth/logout/route.ts` | Create/Modify | Delete cached key on logout |
| `src/lib/entries/crypto.ts` | Modify | Retrieve key from cache |
| `.env.example` | Modify | Add cache config vars |

---

## Security Considerations

1. **Session ID Entropy**: Use 256-bit random session IDs (cryptographically secure)
2. **Cache Security**: Redis should require authentication in production
3. **TTL Alignment**: Cache TTL should match or slightly exceed JWT expiration
4. **Logout Handling**: Always delete cached keys on logout
5. **Error Handling**: Cache failures should fail closed (deny access)

---

## Dependencies

**Required (for Redis):**
```bash
npm install ioredis
# or
npm install redis
```

**Optional (Vercel KV):**
```bash
npm install @vercel/kv
```

---

## Rollback Plan

If issues arise after deployment:
1. Revert code changes
2. Users will need to re-login (new tokens will use old `ek` format)
3. No data loss - encryption keys are derived, not stored

---

## Estimated Effort

| Phase | Tasks |
|-------|-------|
| Phase 1 | Cache infrastructure (4 files) |
| Phase 2 | Session ID generation (1 file) |
| Phase 3 | Auth flow updates (2-3 files) |
| Phase 4 | Session retrieval (1 file) |
| Phase 5 | Session refresh (optional) |
| Phase 6 | Configuration (2 files) |
| Phase 7 | Testing |
| Phase 8 | Migration |

---

## Questions to Resolve

1. **Cache Backend**: Redis, Vercel KV, or in-memory only?
2. **Session Refresh**: Implement sliding window expiration?
3. **Multi-device**: Allow multiple sessions per user?
4. **Key Rotation**: Future consideration for key rotation support?
