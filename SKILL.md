# Password Manager Security - OWASP Aligned Best Practices

## Skill Overview

This skill provides comprehensive security guidance for building a production-grade password manager with zero-knowledge architecture. It integrates OWASP Top 10:2025 and OWASP API Security Top 10:2023 principles specifically tailored for password management applications.

**When to use this skill:**
- Implementing cryptographic features for password storage/retrieval
- Designing authentication and authorization flows
- Reviewing security vulnerabilities in the codebase
- Planning new features that handle sensitive data
- Conducting security audits or threat modeling
- Implementing cross-platform cryptography (Web, Rust, mobile)

---

## Project Context

### Current Architecture
- **Frontend**: NextJS with TypeScript
- **Backend**: NextJS API routes with server-side session management
- **Database**: PostgreSQL with encrypted password vaults
- **Cryptography**: 
  - Argon2ID for password hashing (email-based salt + database salt)
  - PBKDF2 for encryption key derivation
  - AES-256-GCM / ChaCha20-Poly1305 for encryption
  - Libraries: @noble/ciphers, @noble/hashes
- **Architecture**: Zero-knowledge (server cannot decrypt user data)

### Future Plans
- Browser extensions (Firefox, Chrome) for auto-fill
- Shared Rust cryptographic library compiled to:
  - WebAssembly (web/browser)
  - C FFI (mobile via UniFFI)
  - Native (desktop)
- Desktop applications
- Mobile applications (iOS, Android)

---

## OWASP Top 10:2025 - Applied to Password Managers

### A01:2025 - Broken Access Control ⚠️ CRITICAL

**Risks for password managers:**
- Users accessing other users' password vaults
- Unauthorized access to shared passwords
- Privilege escalation to admin functions
- IDOR (Insecure Direct Object References) in API endpoints

**Implementation Guidelines:**

```typescript
// ❌ WRONG - No authorization check
app.get('/api/passwords/:id', async (req, res) => {
  const password = await db.password.findUnique({ 
    where: { id: req.params.id } 
  });
  return res.json(password);
});

// ✅ CORRECT - Verify ownership
app.get('/api/passwords/:id', authenticateUser, async (req, res) => {
  const password = await db.password.findUnique({ 
    where: { 
      id: req.params.id,
      userId: req.user.id  // Ensure user owns this password
    } 
  });
  
  if (!password) {
    return res.status(404).json({ error: 'Password not found' });
  }
  
  return res.json(password);
});
```

**Key Rules:**
1. **ALWAYS** verify object ownership before returning data
2. **NEVER** trust client-supplied IDs without authorization
3. Implement row-level security policies in PostgreSQL
4. Use session-based auth, not JWT with embedded user data
5. Implement rate limiting on sensitive endpoints
6. Log all access to password vaults for audit trails

**Database-Level Protection:**
```sql
-- PostgreSQL Row Level Security (RLS)
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY passwords_isolation_policy ON passwords
  USING (user_id = current_setting('app.current_user_id')::uuid);
```

---

### A02:2025 - Security Misconfiguration ⚠️ HIGH

**Critical configurations for password managers:**

**1. HTTP Security Headers:**
```typescript
// middleware/security-headers.ts
export function securityHeaders(req: Request, res: Response, next: Function) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // HTTPS only
  res.setHeader('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload');
  
  // CSP for password manager
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=()');
  
  next();
}
```

**2. CORS Configuration:**
```typescript
// ❌ WRONG - Open CORS
const corsOptions = {
  origin: '*',
  credentials: true
};

// ✅ CORRECT - Strict CORS
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com'
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600 // 10 minutes
};
```

**3. Environment Variables:**
```bash
# .env.example - NEVER commit actual .env
DATABASE_URL="postgresql://..."
SESSION_SECRET="<generate-with-crypto.randomBytes(64)>"
ENCRYPTION_KEY_PEPPER="<generate-with-crypto.randomBytes(32)>"
NODE_ENV="production"
ALLOWED_ORIGINS="https://yourdomain.com"

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

**4. Production Checklist:**
- [ ] All secrets in environment variables
- [ ] HTTPS enforced (no HTTP allowed)
- [ ] Database connections encrypted (SSL/TLS)
- [ ] Default accounts disabled
- [ ] Error messages sanitized (no stack traces to client)
- [ ] Debug endpoints disabled
- [ ] Unnecessary features/APIs disabled
- [ ] Security headers implemented
- [ ] CORS properly configured
- [ ] Rate limiting active

---

### A03:2025 - Software Supply Chain Failures 🆕 HIGH

**Critical for password managers with many dependencies:**

**1. Dependency Auditing:**
```bash
# Run regularly in CI/CD
npm audit --audit-level=high
npm outdated

# Check for known vulnerabilities
npx snyk test
```

**2. Dependency Management:**
```json
// package.json - Pin exact versions for security-critical deps
{
  "dependencies": {
    "@noble/ciphers": "0.5.3",  // EXACT version, not ^0.5.3
    "@noble/hashes": "1.4.0",
    "argon2": "0.31.2"
  },
  "scripts": {
    "audit": "npm audit --audit-level=high",
    "audit:fix": "npm audit fix",
    "outdated": "npm outdated"
  }
}
```

**3. Subresource Integrity (SRI) for CDN:**
```html
<!-- If using CDN (not recommended for crypto libs, but if needed) -->
<script 
  src="https://cdn.example.com/lib.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/ux..."
  crossorigin="anonymous">
</script>
```

**4. Cryptographic Library Verification:**
```typescript
// Verify cryptographic libraries are authentic
// Check package signatures, use npm provenance
// ONLY use well-audited libraries:
// - @noble/ciphers (audited, modern)
// - @noble/hashes (audited, modern)
// - argon2 (native binding, well-maintained)

// ❌ AVOID:
// - crypto-js (outdated, not audited)
// - bcrypt (use argon2 instead)
// - Custom crypto implementations
```

**5. Supply Chain Security for Rust:**
```toml
# Cargo.toml - Use cargo-audit
[dependencies]
argon2 = "0.5"
chacha20poly1305 = "0.10"
aes-gcm = "0.10"

# Only from crates.io, verify checksums
# Run: cargo audit
```

---

### A04:2025 - Cryptographic Failures ⚠️ CRITICAL

**The most critical category for password managers.**

**1. Password Hashing - Argon2ID:**
```typescript
import argon2 from 'argon2';
import { createHash } from 'crypto';

// ✅ CORRECT Implementation
export async function hashPassword(password: string, email: string): Promise<{
  hash: string;
  salt: string;
}> {
  // Email-based deterministic salt (for client-side consistency)
  const emailSalt = createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex');
  
  // Additional random salt stored in database
  const dbSalt = crypto.randomBytes(32).toString('hex');
  
  // Argon2ID with recommended parameters
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,  // CRITICAL: Use argon2id
    memoryCost: 65536,      // 64 MiB
    timeCost: 3,            // 3 iterations
    parallelism: 4,         // 4 threads
    hashLength: 32,         // 32 bytes output
    salt: Buffer.from(emailSalt + dbSalt, 'hex')
  });
  
  return { hash, salt: dbSalt };
}

// ❌ WRONG - Using bcrypt or weak parameters
const hash = await bcrypt.hash(password, 10); // NO!
```

**2. Encryption Key Derivation - PBKDF2:**
```typescript
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

export function deriveEncryptionKey(
  masterPassword: string,
  email: string,
  pepper: string
): Uint8Array {
  // Combine email + pepper for salt
  const salt = new TextEncoder().encode(email.toLowerCase() + pepper);
  
  // PBKDF2-SHA256 with high iteration count
  const key = pbkdf2(sha256, masterPassword, salt, {
    c: 600_000,  // 600k iterations (OWASP 2023 recommendation)
    dkLen: 32    // 256-bit key
  });
  
  return key;
}

// CRITICAL: Never store this key, always derive on-demand
// CRITICAL: Use different keys for different purposes
```

**3. Encryption - AES-256-GCM / ChaCha20-Poly1305:**
```typescript
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/hashes/utils';

export function encryptPassword(
  plaintext: string,
  encryptionKey: Uint8Array
): { ciphertext: string; nonce: string; authTag: string } {
  
  // Generate random nonce (CRITICAL: Never reuse!)
  const nonce = randomBytes(12); // 96 bits for GCM
  
  // Encrypt with AES-256-GCM
  const aes = gcm(encryptionKey, nonce);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = aes.encrypt(data);
  
  // GCM provides authentication tag automatically
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64'),
    authTag: '' // Included in ciphertext with @noble/ciphers
  };
}

export function decryptPassword(
  ciphertext: string,
  nonce: string,
  encryptionKey: Uint8Array
): string {
  const aes = gcm(
    encryptionKey,
    Buffer.from(nonce, 'base64')
  );
  
  const decrypted = aes.decrypt(
    Buffer.from(ciphertext, 'base64')
  );
  
  return new TextDecoder().decode(decrypted);
}
```

**4. Alternative - ChaCha20-Poly1305:**
```typescript
import { chacha20poly1305 } from '@noble/ciphers/chacha';

export function encryptPasswordChaCha(
  plaintext: string,
  encryptionKey: Uint8Array
): { ciphertext: string; nonce: string } {
  
  const nonce = randomBytes(12); // 96 bits
  const cipher = chacha20poly1305(encryptionKey, nonce);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = cipher.encrypt(data);
  
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    nonce: Buffer.from(nonce).toString('base64')
  };
}
```

**5. Critical Cryptographic Rules:**

```typescript
// ✅ DO:
- Use Argon2ID for password hashing (not bcrypt, not scrypt)
- Use PBKDF2-SHA256 with 600k+ iterations for key derivation
- Use AES-256-GCM or ChaCha20-Poly1305 for encryption
- Generate random nonces for EVERY encryption operation
- Use @noble/ciphers and @noble/hashes (audited, modern)
- Derive keys on-demand, never store them
- Use different keys for different purposes
- Always use authenticated encryption (GCM, Poly1305)

// ❌ DON'T:
- Never implement your own crypto
- Never reuse nonces
- Never use ECB mode
- Never use MD5 or SHA1 for security
- Never store master passwords or encryption keys
- Never use crypto-js or similar outdated libraries
- Never use synchronous crypto in production (blocks event loop)
- Never log cryptographic material
```

**6. Key Storage Rules:**
```typescript
// ❌ WRONG - Storing keys in JWT
const token = jwt.sign({ 
  userId: user.id, 
  encryptionKey: key.toString('hex') // NEVER DO THIS
}, secret);

// ✅ CORRECT - Server-side session storage
const sessionData = {
  userId: user.id,
  encryptionKey: key.toString('base64'), // Ephemeral, in-memory only
  createdAt: Date.now()
};
await setSessionData(sessionId, sessionData);

// Clear encryption key after timeout
setTimeout(() => {
  delete sessionData.encryptionKey;
}, 15 * 60 * 1000); // 15 minutes
```

---

### A05:2025 - Injection

**SQL Injection Prevention:**
```typescript
// ✅ CORRECT - Using Prisma (parameterized)
const passwords = await prisma.password.findMany({
  where: {
    userId: userId,
    title: {
      contains: searchQuery  // Prisma handles escaping
    }
  }
});

// ❌ WRONG - Raw SQL with concatenation
const passwords = await prisma.$queryRaw(
  `SELECT * FROM passwords WHERE user_id = '${userId}'` // NEVER!
);

// ✅ CORRECT - If raw SQL needed, use parameters
const passwords = await prisma.$queryRaw`
  SELECT * FROM passwords WHERE user_id = ${userId}
`;
```

**NoSQL Injection (if using JSON storage):**
```typescript
// ❌ WRONG - Direct object in query
const filter = JSON.parse(req.body.filter); // User controlled!
const result = await collection.find(filter);

// ✅ CORRECT - Validate and sanitize
import { z } from 'zod';

const FilterSchema = z.object({
  title: z.string().max(100),
  category: z.enum(['login', 'note', 'card'])
});

const filter = FilterSchema.parse(req.body.filter);
```

---

### A06:2025 - Insecure Design

**Threat Modeling for Password Managers:**

**1. Trust Boundaries:**
```
┌──────────────────────────────────────────────┐
│  Client (Browser/App)                        │
│  - Master Password (NEVER sent to server)    │
│  - Encryption Key Derivation                 │
│  - Encrypt/Decrypt passwords                 │
└──────────────┬───────────────────────────────┘
               │ HTTPS
               │ Encrypted Vault + Auth Token
┌──────────────▼───────────────────────────────┐
│  Server                                      │
│  - Store encrypted vaults (can't decrypt)    │
│  - Authentication                            │
│  - Session management                        │
│  - Audit logs                                │
└──────────────┬───────────────────────────────┘
               │ Encrypted Connection
┌──────────────▼───────────────────────────────┐
│  Database                                    │
│  - Encrypted password vaults                 │
│  - User hashes (Argon2ID)                    │
│  - Metadata only                             │
└──────────────────────────────────────────────┘
```

**2. Zero-Knowledge Architecture Principles:**
```typescript
// Client-side encryption workflow
async function savePassword(password: PasswordEntry) {
  // 1. Derive encryption key from master password (client-side ONLY)
  const encryptionKey = deriveKeyFromMasterPassword(
    masterPassword,  // Never sent to server
    userEmail
  );
  
  // 2. Encrypt password (client-side)
  const encrypted = encryptPassword(password.value, encryptionKey);
  
  // 3. Send encrypted vault to server
  await api.post('/api/passwords', {
    title: password.title,  // Can be plaintext or encrypted
    username: password.username,
    encryptedPassword: encrypted.ciphertext,
    nonce: encrypted.nonce,
    category: password.category
  });
  
  // 4. Clear sensitive data from memory
  encryptionKey.fill(0);
}

// Server NEVER has access to:
// - Master password
// - Encryption keys
// - Decrypted password values
```

**3. Secure Design Patterns:**

**Rate Limiting:**
```typescript
import rateLimit from 'express-rate-limit';

// Login endpoint - strict limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis for distributed systems
  store: new RedisStore({ client: redisClient })
});

app.post('/api/auth/login', loginLimiter, loginHandler);

// Password retrieval - moderate limit
const passwordLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests
  skipSuccessfulRequests: false
});

app.get('/api/passwords', passwordLimiter, getPasswordsHandler);
```

**Account Lockout:**
```typescript
async function handleFailedLogin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  const newAttempts = (user.failedAttempts || 0) + 1;
  
  if (newAttempts >= 5) {
    // Lock account for 30 minutes
    await db.user.update({
      where: { id: userId },
      data: {
        failedAttempts: newAttempts,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
      }
    });
    
    // Send alert email
    await sendSecurityAlert(user.email, 'Account locked due to multiple failed login attempts');
  } else {
    await db.user.update({
      where: { id: userId },
      data: { failedAttempts: newAttempts }
    });
  }
}
```

---

### A07:2025 - Authentication Failures ⚠️ CRITICAL

**1. Secure Session Management:**
```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';

const sessionConfig = {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'sessionId', // Don't use default 'connect.sid'
  cookie: {
    secure: true,      // HTTPS only
    httpOnly: true,    // No JavaScript access
    sameSite: 'strict', // CSRF protection
    maxAge: 15 * 60 * 1000, // 15 minutes
    domain: process.env.COOKIE_DOMAIN
  }
};

app.use(session(sessionConfig));
```

**2. Multi-Factor Authentication (MFA):**
```typescript
// Time-based OTP (TOTP)
import speakeasy from 'speakeasy';

async function setupMFA(userId: string) {
  const secret = speakeasy.generateSecret({
    name: `PasswordManager (${userEmail})`,
    length: 32
  });
  
  await db.user.update({
    where: { id: userId },
    data: { 
      mfaSecret: encryptSecret(secret.base32), // Encrypt secret
      mfaEnabled: false // User must verify first
    }
  });
  
  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
}

async function verifyMFA(userId: string, token: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  const secret = decryptSecret(user.mfaSecret);
  
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1 // Allow 1 step before/after for clock drift
  });
}
```

**3. Email Verification (Numeric Code):**
```typescript
import crypto from 'crypto';

async function sendVerificationCode(email: string): Promise<void> {
  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  
  // Store hashed code (not plaintext!)
  const hashedCode = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  
  await db.verificationCode.create({
    data: {
      email: email.toLowerCase(),
      codeHash: hashedCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0
    }
  });
  
  // Send email (use email service, not shown)
  await sendEmail(email, `Your verification code is: ${code}`);
}

async function verifyCode(email: string, code: string): Promise<boolean> {
  const record = await db.verificationCode.findFirst({
    where: {
      email: email.toLowerCase(),
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!record || record.attempts >= 3) {
    return false;
  }
  
  const hashedInput = crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
  
  if (hashedInput === record.codeHash) {
    await db.verificationCode.delete({ where: { id: record.id } });
    return true;
  }
  
  // Increment attempts
  await db.verificationCode.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } }
  });
  
  return false;
}
```

**4. Password Requirements:**
```typescript
import zxcvbn from 'zxcvbn';

function validateMasterPassword(password: string): { 
  valid: boolean; 
  score: number; 
  feedback: string[] 
} {
  // Minimum requirements
  if (password.length < 12) {
    return { 
      valid: false, 
      score: 0, 
      feedback: ['Password must be at least 12 characters'] 
    };
  }
  
  // Use zxcvbn for strength estimation
  const result = zxcvbn(password);
  
  // Require score >= 3 (0-4 scale, 3 = strong)
  if (result.score < 3) {
    return {
      valid: false,
      score: result.score,
      feedback: result.feedback.suggestions
    };
  }
  
  return {
    valid: true,
    score: result.score,
    feedback: []
  };
}
```

---

### A08:2025 - Software or Data Integrity Failures

**1. Code Signing (for browser extensions):**
```bash
# Sign extension with private key
web-ext sign \
  --api-key=$AMO_API_KEY \
  --api-secret=$AMO_API_SECRET \
  --channel=listed
```

**2. Integrity Checks:**
```typescript
// Verify data integrity with HMAC
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';

function createIntegrityTag(data: string, key: Uint8Array): string {
  const tag = hmac(sha256, key, new TextEncoder().encode(data));
  return Buffer.from(tag).toString('hex');
}

function verifyIntegrity(
  data: string, 
  tag: string, 
  key: Uint8Array
): boolean {
  const expectedTag = createIntegrityTag(data, key);
  return expectedTag === tag;
}

// Store passwords with integrity tags
interface SecurePasswordEntry {
  encryptedData: string;
  nonce: string;
  integrityTag: string;  // Prevents tampering
  version: number;        // Schema version
}
```

**3. CI/CD Security:**
```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run npm audit
        run: npm audit --audit-level=high
      
      - name: Run Snyk test
        run: npx snyk test --severity-threshold=high
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      - name: Run SAST scan
        run: npx semgrep --config=auto
      
      - name: Check for secrets
        run: npx gitleaks detect --verbose
```

---

### A09:2025 - Security Logging and Alerting Failures

**1. Comprehensive Logging:**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'password-manager' },
  transports: [
    new winston.transports.File({ 
      filename: 'error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'security.log',
      level: 'warn'
    })
  ]
});

// Security events to log
enum SecurityEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  PASSWORD_ACCESSED = 'PASSWORD_ACCESSED',
  PASSWORD_CREATED = 'PASSWORD_CREATED',
  PASSWORD_DELETED = 'PASSWORD_DELETED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE'
}

function logSecurityEvent(
  event: SecurityEvent,
  userId: string,
  metadata: Record<string, any> = {}
) {
  logger.warn({
    event,
    userId,
    timestamp: new Date().toISOString(),
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    ...metadata
  });
  
  // Alert on critical events
  if ([
    SecurityEvent.ACCOUNT_LOCKED,
    SecurityEvent.ENCRYPTION_FAILURE,
    SecurityEvent.SUSPICIOUS_ACTIVITY
  ].includes(event)) {
    sendAlert(event, userId, metadata);
  }
}
```

**2. Audit Trail:**
```typescript
// Database schema for audit log
model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  event       String
  resource    String?  // password ID, etc.
  action      String   // CREATE, READ, UPDATE, DELETE
  ipAddress   String
  userAgent   String
  timestamp   DateTime @default(now())
  metadata    Json?
  
  user        User     @relation(fields: [userId], references: [id])
  
  @@index([userId, timestamp])
  @@index([event, timestamp])
}

async function createAuditLog(
  userId: string,
  event: string,
  action: string,
  req: Request
) {
  await db.auditLog.create({
    data: {
      userId,
      event,
      action,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date()
    }
  });
}
```

**3. Alerting System:**
```typescript
async function sendAlert(
  event: SecurityEvent,
  userId: string,
  metadata: Record<string, any>
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  // Email alert
  await sendEmail(user.email, {
    subject: `Security Alert: ${event}`,
    body: `
      A security event was detected on your account:
      
      Event: ${event}
      Time: ${new Date().toISOString()}
      IP Address: ${metadata.ip}
      Location: ${metadata.location || 'Unknown'}
      
      If this wasn't you, please secure your account immediately.
    `
  });
  
  // Slack/Discord webhook for admins
  if (event === SecurityEvent.SUSPICIOUS_ACTIVITY) {
    await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 Suspicious activity detected for user ${userId}`,
        attachments: [{
          color: 'danger',
          fields: [
            { title: 'Event', value: event, short: true },
            { title: 'IP', value: metadata.ip, short: true },
            { title: 'User Agent', value: metadata.userAgent }
          ]
        }]
      })
    });
  }
}
```

---

### A10:2025 - Mishandling of Exceptional Conditions 🆕

**1. Proper Error Handling:**
```typescript
// ❌ WRONG - Exposing internal errors
app.post('/api/passwords', async (req, res) => {
  try {
    const password = await createPassword(req.body);
    res.json(password);
  } catch (error) {
    // Exposes stack trace and internal info!
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// ✅ CORRECT - Safe error handling
app.post('/api/passwords', async (req, res) => {
  try {
    const password = await createPassword(req.body);
    res.json(password);
  } catch (error) {
    // Log full error internally
    logger.error('Failed to create password', { 
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    // Return sanitized error to client
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Invalid password data' 
      });
    }
    
    // Generic error for unexpected failures
    res.status(500).json({ 
      error: 'An error occurred while processing your request' 
    });
  }
});
```

**2. Fail Securely:**
```typescript
// ✅ Fail secure - deny by default
async function checkAccess(userId: string, passwordId: string): Promise<boolean> {
  try {
    const password = await db.password.findUnique({
      where: { id: passwordId }
    });
    
    // Explicit ownership check
    if (password && password.userId === userId) {
      return true;
    }
    
    // Default deny
    return false;
    
  } catch (error) {
    // Log error
    logger.error('Access check failed', { error, userId, passwordId });
    
    // FAIL SECURE - deny access on error
    return false;
  }
}

// ❌ WRONG - Fail open
async function checkAccessWrong(userId: string, passwordId: string): Promise<boolean> {
  try {
    const password = await db.password.findUnique({
      where: { id: passwordId }
    });
    return password.userId === userId;
  } catch (error) {
    // DANGEROUS - grants access on error!
    return true;
  }
}
```

**3. Input Validation:**
```typescript
import { z } from 'zod';

// Define strict schemas
const CreatePasswordSchema = z.object({
  title: z.string().min(1).max(200),
  username: z.string().min(1).max(200),
  encryptedPassword: z.string(),
  nonce: z.string(),
  category: z.enum(['login', 'note', 'card', 'other']),
  url: z.string().url().optional(),
  notes: z.string().max(1000).optional()
});

app.post('/api/passwords', async (req, res) => {
  try {
    // Validate input
    const data = CreatePasswordSchema.parse(req.body);
    
    // Process valid data
    const password = await createPassword(req.user.id, data);
    res.json(password);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    throw error; // Let global handler catch it
  }
});
```

---

## OWASP API Security Top 10:2023

### API1:2023 - Broken Object Level Authorization (BOLA) ⚠️ CRITICAL

**Most common API vulnerability - ALWAYS verify ownership:**

```typescript
// Middleware to verify ownership
async function verifyPasswordOwnership(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  const passwordId = req.params.id;
  const userId = req.user.id;
  
  const password = await db.password.findUnique({
    where: { id: passwordId },
    select: { userId: true } // Only fetch what we need
  });
  
  if (!password) {
    return res.status(404).json({ error: 'Password not found' });
  }
  
  if (password.userId !== userId) {
    // Log unauthorized access attempt
    logSecurityEvent(
      SecurityEvent.SUSPICIOUS_ACTIVITY,
      userId,
      { attemptedPasswordId: passwordId, ip: req.ip }
    );
    
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
}

// Apply to all password routes
app.get('/api/passwords/:id', 
  authenticateUser, 
  verifyPasswordOwnership, 
  getPasswordHandler
);

app.put('/api/passwords/:id', 
  authenticateUser, 
  verifyPasswordOwnership, 
  updatePasswordHandler
);

app.delete('/api/passwords/:id', 
  authenticateUser, 
  verifyPasswordOwnership, 
  deletePasswordHandler
);
```

---

### API2:2023 - Broken Authentication

**Already covered in A07 above - see session management, MFA, and rate limiting sections.**

---

### API3:2023 - Broken Object Property Level Authorization

**Prevent mass assignment and excessive data exposure:**

```typescript
// ❌ WRONG - Client can modify any field
app.put('/api/passwords/:id', async (req, res) => {
  await db.password.update({
    where: { id: req.params.id },
    data: req.body // User could set { userId: 'someone-else' }!
  });
});

// ✅ CORRECT - Whitelist allowed fields
const UpdatePasswordSchema = z.object({
  title: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
  encryptedPassword: z.string().optional(),
  nonce: z.string().optional(),
  category: z.enum(['login', 'note', 'card', 'other']).optional(),
  url: z.string().url().optional(),
  notes: z.string().max(1000).optional()
  // userId NOT allowed to be updated!
});

app.put('/api/passwords/:id', async (req, res) => {
  const allowedData = UpdatePasswordSchema.parse(req.body);
  
  await db.password.update({
    where: { 
      id: req.params.id,
      userId: req.user.id // Ensure ownership
    },
    data: allowedData
  });
});

// ✅ CORRECT - Don't expose sensitive fields
app.get('/api/users/me', async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      mfaEnabled: true,
      // DON'T include: passwordHash, mfaSecret, etc.
    }
  });
  
  res.json(user);
});
```

---

### API4:2023 - Unrestricted Resource Consumption

**Already covered in A06 - see rate limiting section.**

Additional considerations:

```typescript
// Limit vault size
const MAX_PASSWORDS_PER_USER = 1000;

async function createPassword(userId: string, data: any) {
  const count = await db.password.count({
    where: { userId }
  });
  
  if (count >= MAX_PASSWORDS_PER_USER) {
    throw new Error('Maximum password limit reached');
  }
  
  return db.password.create({
    data: { ...data, userId }
  });
}

// Limit export frequency
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 exports per hour
  message: 'Too many export requests'
});

app.post('/api/export', exportLimiter, exportHandler);
```

---

### API8:2023 - Security Misconfiguration

**Already covered in A02 - see security headers and configuration sections.**

---

### API9:2023 - Improper Inventory Management

**Document and version your API:**

```typescript
// Version your API
app.use('/api/v1', v1Router);
// Don't expose /api/v0, /api/debug, /api/test in production

// API Documentation
/**
 * @swagger
 * /api/v1/passwords:
 *   get:
 *     summary: Get all passwords for current user
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: List of encrypted passwords
 *       401:
 *         description: Unauthorized
 */

// Disable deprecated endpoints
if (process.env.NODE_ENV === 'production') {
  app.use('/api/debug', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}
```

---

## Cross-Platform Cryptography (Rust → WASM/Mobile)

### Rust Cryptographic Library

```rust
// crypto-core/src/lib.rs
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2
};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce
};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;

// Password hashing
pub fn hash_password(password: &str, salt: &[u8]) -> Result<String, Error> {
    let argon2 = Argon2::default();
    let salt = SaltString::encode_b64(salt)?;
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

// Key derivation
pub fn derive_key(password: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(
        password.as_bytes(),
        salt,
        iterations,
        &mut key
    );
    key
}

// Encryption
pub fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<(Vec<u8>, Vec<u8>), Error> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, plaintext)?;
    Ok((ciphertext, nonce.to_vec()))
}

// Decryption
pub fn decrypt(
    ciphertext: &[u8], 
    nonce: &[u8], 
    key: &[u8; 32]
) -> Result<Vec<u8>, Error> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(nonce);
    let plaintext = cipher.decrypt(nonce, ciphertext)?;
    Ok(plaintext)
}
```

### Compile to WebAssembly

```toml
# Cargo.toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
argon2 = "0.5"
chacha20poly1305 = "0.10"
pbkdf2 = "0.12"
sha2 = "0.10"
wasm-bindgen = "0.2"

[target.'cfg(target_arch = "wasm32")'.dependencies]
getrandom = { version = "0.2", features = ["js"] }
```

```bash
# Build WASM
wasm-pack build --target web --out-dir ../web/wasm

# Use in web app
npm install ../crypto-core/pkg
```

### Compile for Mobile (UniFFI)

```toml
# Cargo.toml
[dependencies]
uniffi = "0.25"

[build-dependencies]
uniffi_build = "0.25"
```

```bash
# Generate bindings
cargo build --release

# iOS
uniffi-bindgen generate src/crypto.udl --language swift

# Android
uniffi-bindgen generate src/crypto.udl --language kotlin
```

---

## Security Testing Checklist

### Automated Tests

```typescript
// tests/security/crypto.test.ts
import { describe, test, expect } from 'vitest';

describe('Cryptography', () => {
  test('should never reuse nonces', () => {
    const nonces = new Set();
    
    for (let i = 0; i < 1000; i++) {
      const { nonce } = encryptPassword('test', key);
      expect(nonces.has(nonce)).toBe(false);
      nonces.add(nonce);
    }
  });
  
  test('should derive different keys for different users', () => {
    const key1 = deriveEncryptionKey('password123', 'user1@example.com', pepper);
    const key2 = deriveEncryptionKey('password123', 'user2@example.com', pepper);
    
    expect(key1).not.toEqual(key2);
  });
  
  test('should fail decryption with wrong key', () => {
    const encrypted = encryptPassword('secret', correctKey);
    
    expect(() => {
      decryptPassword(encrypted.ciphertext, encrypted.nonce, wrongKey);
    }).toThrow();
  });
  
  test('should not leak master password to server', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const fetchSpy = vi.spyOn(global, 'fetch');
    
    await loginUser('master-password-123', 'user@example.com');
    
    // Ensure master password never appears in network requests
    fetchSpy.mock.calls.forEach(call => {
      const body = JSON.stringify(call[1]?.body);
      expect(body).not.toContain('master-password-123');
    });
  });
});

describe('Access Control', () => {
  test('should not allow access to other users passwords', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    const password = await createPassword(user1.id, testData);
    
    const response = await fetch(`/api/passwords/${password.id}`, {
      headers: { Authorization: `Bearer ${user2.token}` }
    });
    
    expect(response.status).toBe(403);
  });
});
```

### Manual Security Testing

```bash
# Run OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000

# Run security headers check
npx security-headers-check http://localhost:3000

# Run dependency audit
npm audit --audit-level=moderate

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# Test CORS
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS http://localhost:3000/api/passwords

# Test session timeout
# Login, wait 16 minutes, try to access API
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set
- [ ] Database migrations tested
- [ ] SSL/TLS certificates configured
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers configured
- [ ] CORS properly restricted
- [ ] Rate limiting enabled
- [ ] Session store configured (Redis)
- [ ] Logging and monitoring setup
- [ ] Error tracking (Sentry, etc.)
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented

### Security Configuration

- [ ] All secrets rotated for production
- [ ] MFA enforced for admin accounts
- [ ] Password policy enforced
- [ ] Account lockout enabled
- [ ] Audit logging active
- [ ] Security alerts configured
- [ ] WAF configured (Cloudflare, AWS WAF)
- [ ] DDoS protection enabled
- [ ] IP whitelisting for admin routes
- [ ] Regular security scans scheduled

### Cryptography

- [ ] Argon2ID with correct parameters
- [ ] PBKDF2 iterations ≥ 600,000
- [ ] AES-256-GCM or ChaCha20-Poly1305
- [ ] Nonce generation tested
- [ ] Key derivation tested
- [ ] Encryption/decryption tested
- [ ] No keys in logs or errors
- [ ] Secure random number generator used
- [ ] Cryptographic libraries audited
- [ ] Zero-knowledge architecture verified

### Compliance

- [ ] GDPR compliance (if EU users)
- [ ] CCPA compliance (if CA users)
- [ ] SOC 2 requirements (if applicable)
- [ ] Data retention policy implemented
- [ ] Right to be forgotten implemented
- [ ] Data export functionality
- [ ] Privacy policy updated
- [ ] Terms of service updated

---

## Incident Response Plan

### Detection
1. Monitor security logs for anomalies
2. Set up alerts for suspicious patterns
3. Review audit logs daily
4. Track failed login attempts
5. Monitor for unusual API usage

### Response
1. Identify the scope of the breach
2. Contain the incident (lock accounts, disable features)
3. Notify affected users
4. Preserve evidence
5. Patch vulnerabilities
6. Document the incident

### Recovery
1. Restore from backups if needed
2. Force password resets for affected users
3. Revoke compromised sessions
4. Update security measures
5. Conduct post-mortem analysis

### Communication
1. Notify users within 72 hours (GDPR requirement)
2. Provide clear instructions
3. Offer support resources
4. Document all communications
5. Report to authorities if required

---

## Resources

### OWASP References
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP API Security Top 10:2023](https://owasp.org/API-Security/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

### Cryptographic Libraries
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) - Audited, modern encryption
- [@noble/hashes](https://github.com/paulmillr/noble-hashes) - Audited hash functions
- [RustCrypto](https://github.com/RustCrypto) - Rust cryptographic libraries

### Security Tools
- [OWASP ZAP](https://www.zaproxy.org/) - Security scanner
- [Snyk](https://snyk.io/) - Dependency scanning
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit) - Built-in vulnerability checker
- [cargo audit](https://github.com/RustSec/rustsec/tree/main/cargo-audit) - Rust security audit

### Testing
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Security Headers](https://securityheaders.com/) - Header checker
- [SSL Labs](https://www.ssllabs.com/ssltest/) - TLS configuration test

---

## Conclusion

This skill provides a comprehensive framework for building a secure password manager aligned with the latest OWASP standards. The key principles are:

1. **Zero-Knowledge Architecture** - Server never has access to decrypted data
2. **Defense in Depth** - Multiple layers of security controls
3. **Fail Securely** - Default to deny when errors occur
4. **Audit Everything** - Comprehensive logging and monitoring
5. **Stay Updated** - Regular security updates and audits

Remember: Security is not a feature, it's a requirement. Every decision must prioritize the security and privacy of user data.

**When in doubt, err on the side of caution and security.**
