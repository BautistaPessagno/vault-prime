# Cryptographic Workflow

This document explains how password hashing, key derivation, and entry encryption work in Vault Prime.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER AUTHENTICATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Input                    Key Derivation                   Storage     │
│  ───────────                   ──────────────                   ───────     │
│                                                                             │
│  email ─────────────────────────────────┐                                   │
│                                         ▼                                   │
│  password ──────► Argon2id ──────► masterKey ──────► Argon2id ──────► DB    │
│                   (email salt)          │            (random salt)          │
│                                         │                                   │
│                                         ▼                                   │
│                                  HKDF-SHA256 ──────► encryptionKey          │
│                                  (password salt)          │                 │
│                                                           ▼                 │
│                                                    Server Cache             │
│                                                    (TTL: 15 min)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

### 1. Password to Master Key

```
Input:  email, password
Output: masterKey (Argon2id hash)

masterKey = Argon2id(password, salt=email, memoryCost=64MiB)
```

The user's email is used as a deterministic salt for the first hash. This ensures:
- Same password + email always produces the same master key
- Different users with the same password get different master keys

### 2. Master Key to Stored Hash

```
Input:  masterKey
Output: masterPasswordHash (stored in database)

masterPasswordHash = Argon2id(masterKey, salt=random, memoryCost=64MiB)
```

A second Argon2id hash with a random salt is stored in the database. This is used to verify the user's password on login.

### 3. Encryption Key Derivation

```
Input:  masterKey, password
Output: encryptionKey (256-bit AES key)

encryptionKey = HKDF-SHA256(masterKey, salt=password, length=32 bytes)
```

The encryption key is derived using HKDF (HMAC-based Key Derivation Function) with SHA-256. This key is used to encrypt/decrypt vault entries.

### 4. Session Management

```
┌─────────────────────────────────────────────────────────────┐
│ Login/Signup                                                │
│                                                             │
│ 1. Derive encryptionKey from masterKey + password          │
│ 2. Generate random sessionId (256-bit)                     │
│ 3. Store in cache: cache[sessionId] = encryptionKey        │
│ 4. Create JWT with sessionId (not the key itself)          │
│ 5. Set HTTP-only cookie with JWT                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ API Request                                                 │
│                                                             │
│ 1. Extract JWT from cookie                                 │
│ 2. Verify JWT signature (HS256)                            │
│ 3. Get sessionId from JWT payload                          │
│ 4. Lookup encryptionKey from cache[sessionId]              │
│ 5. Use key for entry encryption/decryption                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Logout                                                      │
│                                                             │
│ 1. Delete cache[sessionId]                                 │
│ 2. Clear session cookie                                    │
└─────────────────────────────────────────────────────────────┘
```

## Entry Encryption

Each vault entry field is encrypted using AES-256-GCM.

```
┌─────────────────────────────────────────────────────────────┐
│ Encrypt Entry Field                                         │
│                                                             │
│ Input:  plaintext, encryptionKey                           │
│ Output: nonce:ciphertext (hex encoded)                     │
│                                                             │
│ 1. Generate random nonce (24 bytes)                        │
│ 2. ciphertext = AES-256-GCM(key, nonce, plaintext)        │
│ 3. Return: hex(nonce) + ":" + hex(ciphertext)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Decrypt Entry Field                                         │
│                                                             │
│ Input:  stored value, encryptionKey                        │
│ Output: plaintext                                          │
│                                                             │
│ 1. Split stored value by ":"                               │
│ 2. nonce = hex_decode(parts[0])                            │
│ 3. ciphertext = hex_decode(parts[1])                       │
│ 4. plaintext = AES-256-GCM_decrypt(key, nonce, ciphertext) │
└─────────────────────────────────────────────────────────────┘
```

### Encrypted Fields

| Field | Encrypted |
|-------|-----------|
| nombre | Yes |
| usuario | Yes |
| password | Yes |
| url | Yes |
| id | No |
| user_id | No |
| last_edited | No |
| last_copied | No |

## Cryptographic Algorithms

| Purpose | Algorithm | Parameters |
|---------|-----------|------------|
| Password hashing | Argon2id | memoryCost=64MiB |
| Key derivation | HKDF-SHA256 | 32 bytes output |
| Entry encryption | AES-256-GCM | 24-byte nonce |
| JWT signing | HMAC-SHA256 | - |
| Session ID | Random bytes | 32 bytes (256-bit) |

## Security Properties

1. **Zero-knowledge**: The server never sees the user's password in plaintext after initial processing
2. **Key isolation**: Encryption keys are stored in cache, not in JWTs or database
3. **Forward secrecy**: Each session gets a unique session ID
4. **Authenticated encryption**: AES-GCM provides both confidentiality and integrity
5. **Unique nonces**: Each encrypted field uses a fresh random nonce

## Cache Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection URL (optional) |
| `KEY_CACHE_TTL` | 900 | Cache TTL in seconds (15 min) |

If `REDIS_URL` is not set, an in-memory cache is used.
