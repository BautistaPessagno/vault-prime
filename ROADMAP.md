# Vault Prime - Development Roadmap

## Project Overview
Vault Prime is a secure, self-hosted password manager built with Next.js, TypeScript, and PostgreSQL. This roadmap outlines the path to adding advanced features while maintaining security and ease of development.

**Current Tech Stack:**
- Frontend: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- Backend: Next.js API Routes
- Database: PostgreSQL + Drizzle ORM
- Encryption: AES-256-GCM + Argon2id + HKDF-SHA256
- Authentication: JWT + Email Verification

---

## Development Phases

### 🔵 Phase 1: Core Data Types & Recovery (Weeks 1-3)
**Priority: HIGH** | **Complexity: Medium**

Build foundational features that extend the current vault model and add critical account recovery.

#### 1.1 Secure Notes & Environment Variables
**Effort: 1-2 weeks**

Extend the current `entries` system to support multiple entry types.

**Technical Approach:**
- Add `entry_type` enum field to entries table: `password`, `note`, `env_file`
- Reuse existing encryption infrastructure (AES-256-GCM)
- Add UI components for note editor and env file manager

**Database Changes:**
```sql
ALTER TABLE entries ADD COLUMN entry_type VARCHAR(20) DEFAULT 'password';
ALTER TABLE entries ADD COLUMN content TEXT; -- For notes/env data
ALTER TABLE entries ADD COLUMN metadata JSONB; -- For env file structure
```

**Tasks:**
- [ ] Update database schema with entry_type and content fields
- [ ] Create migration for existing entries (set type to 'password')
- [ ] Update encryption/decryption to handle larger content fields
- [ ] Build secure note editor UI component
- [ ] Build .env file manager UI (key-value pairs editor)
- [ ] Add syntax highlighting for .env files
- [ ] Update entry list to show different icons for each type
- [ ] Add filters by entry type
- [ ] Update API endpoints to support new fields
- [ ] Add validation for env file format

**Benefits:**
- Minimal changes to existing architecture
- Reuses proven encryption system
- Foundation for sharing (Phase 2)

---

#### 1.2 Password Change & Master Key Rotation
**Effort: 2-3 weeks** | **⚠️ CRITICAL SECURITY FEATURE**

Enable users to change their master password while re-encrypting all vault data.

**Technical Challenge:**
The current system derives encryption keys from the master password. Changing the password requires:
1. Decrypt all entries with old key
2. Derive new encryption key from new password
3. Re-encrypt all entries with new key
4. Update master password hash

**Implementation Strategy:**
```typescript
// Password change flow
1. User provides current password + new password
2. Verify current password against master_password_hash
3. Derive old encryption key from current password
4. Fetch ALL user entries from database
5. Decrypt all entries with old key (in memory)
6. Derive new encryption key from new password
7. Re-encrypt all entries with new key
8. Begin transaction:
   - Update master_password_hash
   - Update all entry records with new encrypted data
   - Commit or rollback
9. Invalidate all active sessions
10. Require re-login with new password
```

**API Endpoint:**
- `POST /api/auth/change-password`
  - Body: `{ currentPassword, newPassword }`
  - Returns: `{ success, entriesRotated }`

**Tasks:**
- [ ] Create key rotation utility function
- [ ] Add batch decryption/re-encryption logic
- [ ] Implement transactional update (all-or-nothing)
- [ ] Add progress indicator for large vaults
- [ ] Create password change UI form
- [ ] Add session invalidation on password change
- [ ] Add email notification for password changes
- [ ] Handle errors gracefully (rollback on failure)
- [ ] Add rate limiting to prevent brute force
- [ ] Write comprehensive tests for edge cases

**Security Considerations:**
- Use database transactions to prevent partial updates
- Invalidate all sessions after password change
- Send email notification about password change
- Add rate limiting (max 3 attempts per hour)
- Never log decrypted data

---

#### 1.3 Account Recovery Mechanism
**Effort: 1-2 weeks**

Since master passwords cannot be recovered (by design), provide alternatives.

**Option A: Recovery Codes (Recommended First)**
Generate one-time recovery codes during account creation.

**Implementation:**
```typescript
// During signup, generate 10 recovery codes
const codes = generateRecoveryCodes(10); // 16-char alphanumeric
const hashedCodes = codes.map(code => hash(code));
// Store hashed codes in database
// Display codes ONCE to user (download/print)

// Recovery flow
1. User enters email + recovery code
2. Verify code against hashed codes in DB
3. Invalidate used code
4. Allow user to set new master password
5. Re-encrypt vault with new password (or reset vault)
```

**Database Schema:**
```sql
CREATE TABLE recovery_codes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Tasks:**
- [ ] Create recovery_codes table
- [ ] Generate recovery codes on signup
- [ ] Create download/print UI for recovery codes
- [ ] Build recovery flow UI
- [ ] Implement code verification endpoint
- [ ] Add "Reset Vault" option (if code used, optionally clear all entries)
- [ ] Add "Re-encrypt with Recovery" (decrypt + re-encrypt with new password)
- [ ] Send email notification on recovery attempt
- [ ] Update signup flow to show recovery codes

**Option B: Trusted Device (Future Enhancement)**
- Store encrypted backup key on trusted device
- Requires device fingerprinting + secure storage

---

### 🟢 Phase 2: Secure Sharing Infrastructure (Weeks 4-7)
**Priority: HIGH** | **Complexity: High**

Enable secure sharing of passwords, notes, and env files with other users.

#### 2.1 Sharing Architecture Design
**Effort: 1 week**

Design the cryptographic approach for secure sharing.

**Recommended Approach: Public Key Cryptography**

Each user gets an RSA key pair:
- **Private key**: Encrypted with user's master password, stored in DB
- **Public key**: Stored unencrypted in DB

**Sharing Flow:**
```typescript
// Alice shares entry with Bob
1. Alice decrypts entry with her encryption key
2. Alice encrypts entry data with Bob's public key
3. Store shared entry reference in shared_entries table
4. Bob decrypts shared entry with his private key (decrypted via his master password)
```

**Alternative: Symmetric Key Sharing**
- Generate random symmetric key for each shared entry
- Encrypt entry with symmetric key
- Encrypt symmetric key separately for each recipient using their public key
- More efficient for group sharing

**Database Schema:**
```sql
CREATE TABLE user_keys (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL, -- Encrypted with master password
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shared_entries (
  id UUID PRIMARY KEY,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  encrypted_data TEXT NOT NULL, -- Entry encrypted with recipient's public key
  permissions JSONB, -- { canEdit: false, canReshare: false }
  shared_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(entry_id, recipient_id)
);

CREATE TABLE share_invitations (
  id UUID PRIMARY KEY,
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  recipient_email TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

**Tasks:**
- [ ] Design complete cryptographic protocol
- [ ] Choose between RSA and symmetric key approach
- [ ] Create database schema for sharing
- [ ] Document security guarantees and limitations
- [ ] Plan permission model (view-only, edit, re-share)

---

#### 2.2 Key Pair Generation & Management
**Effort: 1-2 weeks**

**Library:** Use `@noble/curves` for elliptic curve crypto (smaller keys, faster) or built-in Node.js crypto for RSA.

**Implementation:**
```typescript
// During login, generate keys if not exist
if (!userKeys) {
  const { publicKey, privateKey } = await generateKeyPair();
  const encryptedPrivateKey = encryptWithMasterKey(privateKey, encryptionKey);
  await db.insert(userKeys).values({
    userId,
    publicKey,
    encryptedPrivateKey
  });
}

// Retrieve and decrypt private key for sharing operations
const { encryptedPrivateKey } = await getUserKeys(userId);
const privateKey = decryptWithMasterKey(encryptedPrivateKey, encryptionKey);
```

**Tasks:**
- [ ] Choose crypto library (@noble/curves or Node crypto)
- [ ] Implement key pair generation
- [ ] Add key generation to login flow
- [ ] Add key rotation capability
- [ ] Store encrypted private key in database
- [ ] Create key management API endpoints
- [ ] Handle key migration for existing users
- [ ] Add key backup/recovery mechanism

---

#### 2.3 Share Entry Implementation
**Effort: 2-3 weeks**

**API Endpoints:**
- `POST /api/entries/[id]/share` - Share entry with user(s)
- `GET /api/shares/incoming` - Get entries shared with me
- `GET /api/shares/outgoing` - Get entries I've shared
- `DELETE /api/shares/[id]` - Revoke share
- `PUT /api/shares/[id]/permissions` - Update permissions

**Sharing UI Flow:**
1. User clicks "Share" on an entry
2. Modal opens with recipient email input
3. Set permissions (view-only, can-edit)
4. Send invitation
5. Recipient sees notification/invitation
6. Recipient accepts → entry appears in "Shared with me" section

**Tasks:**
- [ ] Create share API endpoints
- [ ] Implement encryption with recipient's public key
- [ ] Build share modal UI component
- [ ] Add "Shared with me" section to dashboard
- [ ] Add "Shared by me" management view
- [ ] Implement permission enforcement
- [ ] Add email notifications for shares
- [ ] Handle share revocation
- [ ] Add audit log for share actions
- [ ] Prevent sharing with unregistered users (or support invitations)
- [ ] Add share expiration dates (optional)
- [ ] Handle recipient key rotation (re-encrypt shared data)

---

#### 2.4 Share Secure Notes & Environment Variables
**Effort: 1 week**

Extend sharing to all entry types from Phase 1.1.

**Tasks:**
- [ ] Update share logic to handle all entry types
- [ ] Add UI indicators for shared notes/env files
- [ ] Test sharing for large content (notes, env files)
- [ ] Add permissions specific to env files (e.g., view keys only, no values)

---

### 🟡 Phase 3: Advanced Authentication - Passkeys (Weeks 8-10)
**Priority: Medium** | **Complexity: Medium-High**

Implement WebAuthn/FIDO2 for passwordless login using biometrics or hardware keys.

#### 3.1 WebAuthn Integration
**Effort: 2-3 weeks**

**Library:** `@simplewebauthn/server` + `@simplewebauthn/browser`

**Key Concept:**
Passkeys don't replace the master password (needed for encryption), but provide:
- Faster login via biometrics
- Phishing-resistant authentication
- Device-based security

**Architecture:**
1. User registers passkey (fingerprint, Face ID, hardware key)
2. Passkey authenticates user identity
3. After passkey auth, prompt for master password to decrypt vault
4. Cache master password-derived key for session

**Alternative Approach:**
- Store encrypted master password locally (encrypted with passkey)
- Decrypt master password with passkey on login
- **Caution:** Reduces security if device is compromised

**Database Schema:**
```sql
CREATE TABLE passkeys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);
```

**Tasks:**
- [ ] Install SimpleWebAuthn libraries
- [ ] Create passkeys table
- [ ] Implement registration ceremony (create credential)
- [ ] Implement authentication ceremony (verify credential)
- [ ] Build passkey registration UI
- [ ] Build passkey login flow
- [ ] Add device management UI (name/delete passkeys)
- [ ] Decide on master password prompt strategy
- [ ] Handle browser compatibility (fallback for unsupported browsers)
- [ ] Add passkey as optional 2FA layer
- [ ] Test on iOS Safari, Chrome, Firefox
- [ ] Add passkey recovery options

**Security Considerations:**
- Passkeys are device-bound (not portable between devices by default)
- User needs passkey on each device OR cloud-synced passkeys (platform-dependent)
- Always require master password for encryption key derivation

---

### 🟠 Phase 4: Browser Extension (Weeks 11-15)
**Priority: Medium** | **Complexity: High**

Build a cross-browser extension for autofill and quick access.

#### 4.1 Extension Architecture
**Effort: 1 week**

**Tech Stack:**
- Manifest V3 (required for Chrome, compatible with Firefox)
- TypeScript
- React for popup UI
- Content scripts for autofill

**Components:**
```
/extension
├── manifest.json          # Extension config (V3)
├── background/            # Service worker (background tasks)
├── content/              # Content scripts (inject into pages)
├── popup/                # Popup UI (React app)
└── shared/               # Shared utilities (crypto, API client)
```

**Communication Flow:**
```
Web Page ←→ Content Script ←→ Background Script ←→ API Server
              (Detects forms)    (Manages auth)      (Vault data)
                    ↓
                Popup UI (user interaction)
```

**Tasks:**
- [ ] Set up extension project structure
- [ ] Configure Manifest V3
- [ ] Create build pipeline (webpack/vite)
- [ ] Design message passing architecture
- [ ] Plan secure storage strategy (extension storage API)

---

#### 4.2 Authentication & Sync
**Effort: 2-3 weeks**

**Challenges:**
- Extensions can't use httpOnly cookies (security limitation)
- Need secure token storage
- Sync vault data to extension

**Approach:**
```typescript
// Login flow
1. User logs in via extension popup
2. Store JWT in chrome.storage.local (encrypted)
3. Background script periodically syncs vault entries
4. Cache encrypted entries in extension storage
5. Decrypt on-demand in popup or content script
```

**Security:**
- Encrypt cached vault data with session key
- Clear cache on logout/timeout
- Use Content Security Policy (CSP)

**Tasks:**
- [ ] Implement login UI in popup
- [ ] Store tokens securely in extension storage
- [ ] Create background sync service
- [ ] Add session timeout handling
- [ ] Implement logout and cache clearing
- [ ] Add biometric unlock (if available)

---

#### 4.3 Autofill Implementation
**Effort: 2-3 weeks**

**Content Script Tasks:**
1. Detect login forms on page load
2. Show Vault Prime icon in password fields
3. On click, inject autofill dropdown
4. User selects entry, autofill username + password
5. Optionally auto-submit form

**Tasks:**
- [ ] Create content script for form detection
- [ ] Build autofill dropdown UI component
- [ ] Implement field matching (URL-based + fuzzy matching)
- [ ] Add autofill logic for username/password fields
- [ ] Handle multi-page login flows
- [ ] Add auto-submit option (with user preference)
- [ ] Support non-standard form fields
- [ ] Add manual entry selection fallback
- [ ] Test on popular sites (Google, GitHub, Facebook, etc.)
- [ ] Handle SPA form detection (MutationObserver)

---

#### 4.4 Context Menu & Shortcuts
**Effort: 1 week**

**Features:**
- Right-click → "Save to Vault Prime"
- Keyboard shortcut to open popup (Ctrl+Shift+V)
- Quick copy password to clipboard

**Tasks:**
- [ ] Add context menu integration
- [ ] Implement keyboard shortcuts
- [ ] Add "Save password" prompt on form submit
- [ ] Create quick-copy feature
- [ ] Add notification toasts

---

#### 4.5 Cross-Browser Publishing
**Effort: 1 week**

**Targets:**
- Chrome Web Store
- Firefox Add-ons
- Edge Add-ons (uses Chrome store)
- Safari (optional, requires conversion)

**Tasks:**
- [ ] Create Chrome Web Store developer account
- [ ] Prepare extension listing (icons, screenshots, description)
- [ ] Submit to Chrome Web Store
- [ ] Test and submit to Firefox Add-ons
- [ ] Create privacy policy page
- [ ] Set up auto-update mechanism
- [ ] Create user documentation

---

### 🔴 Phase 5: iOS Mobile App (Weeks 16-24)
**Priority: Medium** | **Complexity: Very High**

Native iOS app for password management on iPhone/iPad.

#### 5.1 iOS Project Setup
**Effort: 1-2 weeks**

**Tech Stack Options:**

**Option A: React Native (Recommended)**
- **Pros:** Reuse TypeScript logic, faster development, Android support later
- **Cons:** Limited autofill integration, larger app size
- **Libraries:**
  - `react-native-keychain` - Secure storage
  - `react-native-biometrics` - Face ID/Touch ID
  - Native module for AutoFill credential provider

**Option B: Native Swift + SwiftUI**
- **Pros:** Best iOS integration, autofill support, smaller app
- **Cons:** Separate codebase, slower development
- **Frameworks:**
  - SwiftUI for UI
  - AuthenticationServices for AutoFill
  - CryptoKit for encryption

**Recommended:** Start with React Native for faster MVP, then evaluate native rewrite.

**Tasks:**
- [ ] Choose tech stack (React Native vs Native)
- [ ] Set up Xcode project
- [ ] Configure iOS app bundle ID
- [ ] Set up Apple Developer account
- [ ] Initialize React Native project (if chosen)
- [ ] Configure secure storage
- [ ] Set up code signing

---

#### 5.2 Core App Features
**Effort: 3-4 weeks**

**Features:**
- Login with master password
- Biometric unlock (Face ID / Touch ID)
- Browse vault entries (passwords, notes, env files)
- Search and filter
- View/copy passwords
- Create/edit/delete entries
- Offline mode with sync

**Tasks:**
- [ ] Build login screen with biometric option
- [ ] Create vault list view
- [ ] Build entry detail view
- [ ] Implement search functionality
- [ ] Add create/edit forms
- [ ] Build password generator
- [ ] Implement secure clipboard (auto-clear)
- [ ] Add offline storage with encryption
- [ ] Implement sync logic
- [ ] Handle network errors gracefully

---

#### 5.3 iOS AutoFill Integration
**Effort: 2-3 weeks** | **⚠️ Complex**

**Apple's AutoFill Credential Provider:**
Requires creating an App Extension that integrates with iOS system autofill.

**Implementation:**
```swift
// Create AutoFill Extension target
1. Add AutoFill Credential Provider Extension to Xcode project
2. Implement CredentialProviderViewController
3. Fetch credentials from shared keychain/database
4. Return credentials to iOS autofill system
5. Handle user authentication within extension
```

**Architecture:**
```
Main App ←→ Shared Container ←→ AutoFill Extension
(Vault UI)   (Encrypted DB)     (System integration)
```

**Tasks:**
- [ ] Create AutoFill extension target
- [ ] Implement credential provider protocol
- [ ] Set up app group for shared data
- [ ] Create shared encrypted database
- [ ] Implement authentication in extension
- [ ] Build credential selection UI
- [ ] Test autofill in Safari and apps
- [ ] Handle credential updates/sync
- [ ] Add support for passkeys (iOS 17+)

**Challenges:**
- Extension has separate process and memory limits
- Must handle authentication within extension
- Limited UI customization
- Requires encrypted shared storage

---

#### 5.4 iOS-Specific Features
**Effort: 1-2 weeks**

**Features:**
- Share extension (save passwords from Safari)
- Widgets (quick access to favorite entries)
- Shortcuts integration (Siri shortcuts)
- iCloud sync (optional, alternative to server sync)
- Apple Watch companion app (future)

**Tasks:**
- [ ] Add Share extension for saving passwords
- [ ] Create home screen widget
- [ ] Implement Siri shortcuts
- [ ] Add 3D Touch quick actions
- [ ] Support dark mode
- [ ] Add haptic feedback
- [ ] Implement pull-to-refresh
- [ ] Add swipe gestures

---

#### 5.5 App Store Submission
**Effort: 1-2 weeks**

**Requirements:**
- App Store listing (icons, screenshots, description)
- Privacy policy (required for password managers)
- Cryptography export compliance
- App review guidelines compliance

**Tasks:**
- [ ] Create app icons (all sizes)
- [ ] Capture screenshots for all device sizes
- [ ] Write app description and keywords
- [ ] Create privacy policy
- [ ] Set up App Store Connect
- [ ] Configure in-app purchases (if premium features)
- [ ] Submit for review
- [ ] Handle review feedback
- [ ] Plan marketing/launch

---

## Alternative: Android After iOS
**Effort: 4-6 weeks** (if React Native) or 8-12 weeks (if native)

If React Native is used, Android support requires:
- [ ] Android Studio setup
- [ ] Autofill service implementation (different from iOS)
- [ ] Google Play Console setup
- [ ] Accessibility service for autofill
- [ ] Play Store submission

---

## Development Principles

### 1. **Iterative Development**
- Each phase delivers usable features
- Test thoroughly before moving to next phase
- Gather user feedback between phases

### 2. **Security First**
- All new features must maintain end-to-end encryption
- No plaintext storage of sensitive data
- Regular security audits
- Minimal trust in server

### 3. **Backward Compatibility**
- Database migrations must not break existing data
- API changes should be versioned
- Support legacy clients during transitions

### 4. **Testing Strategy**
- Unit tests for crypto functions
- Integration tests for API endpoints
- E2E tests for critical flows (login, share, autofill)
- Security testing (penetration tests, code review)

### 5. **Code Reusability**
- Share crypto logic across platforms
- Use TypeScript for type safety everywhere
- Create shared UI component library
- Centralize API client logic

---

## Technology Additions by Phase

| Phase | New Technologies |
|-------|------------------|
| 1 | None (uses existing stack) |
| 2 | `@noble/curves` or Node crypto (RSA/ECC) |
| 3 | `@simplewebauthn/server`, `@simplewebauthn/browser` |
| 4 | Manifest V3, webpack/vite for extension build |
| 5 | React Native OR Swift/SwiftUI, iOS SDKs |

---

## Risk Mitigation

### High-Risk Items

1. **Password Change with Re-encryption (Phase 1.2)**
   - **Risk:** Data loss if transaction fails mid-update
   - **Mitigation:** Database transactions, comprehensive testing, backup before operation

2. **Sharing Cryptography (Phase 2)**
   - **Risk:** Complex crypto, potential for key management errors
   - **Mitigation:** Use established libraries, external security audit, extensive testing

3. **iOS AutoFill (Phase 5.3)**
   - **Risk:** Apple's strict guidelines, technical complexity
   - **Mitigation:** Start early research, prototype extension separately, study Apple docs

### Medium-Risk Items

1. **Browser Extension Security (Phase 4)**
   - **Risk:** XSS vulnerabilities, insecure storage
   - **Mitigation:** CSP policies, encrypted cache, regular updates

2. **Passkey Integration (Phase 3)**
   - **Risk:** Browser compatibility issues
   - **Mitigation:** Progressive enhancement, fallback to password auth

---

## Success Metrics

- **Phase 1:** Users can change passwords, create notes/env files
- **Phase 2:** 50% of users utilize sharing features
- **Phase 3:** 30% of users enable passkeys
- **Phase 4:** Extension has 10k+ active users
- **Phase 5:** iOS app passes App Store review on first submission

---

## Estimated Total Timeline

- **Phase 1:** 3 weeks
- **Phase 2:** 4 weeks
- **Phase 3:** 3 weeks
- **Phase 4:** 5 weeks
- **Phase 5:** 9 weeks

**Total:** ~24 weeks (6 months) for full roadmap completion with one developer

**With a small team (2-3 developers):**
- **Parallel development:** ~16 weeks (4 months)
- Phases 1-2 can run in parallel
- Phase 4 & 5 can run in parallel after Phase 2 completes

---

## Next Steps

1. **Review and prioritize** this roadmap with stakeholders
2. **Set up project tracking** (GitHub Projects, Linear, etc.)
3. **Begin Phase 1.1** (Secure Notes & Env Files) - quickest win
4. **Plan security audit** for Phase 2 (Sharing)
5. **Research WebAuthn** for Phase 3
6. **Prototype** browser extension and mobile approach in parallel

---

## Appendix: Alternative Approaches

### Sharing Without Public Key Crypto
If public key crypto is too complex initially:
- **Link-based sharing:** Generate encrypted share links with passwords
- **Simpler but less secure:** Recipient needs both link + password
- **Use case:** Quick sharing, one-time shares

### Mobile-First Alternative
If iOS is higher priority than extensions:
- **Swap Phase 4 ↔ Phase 5**
- Considerations: Mobile users may expect browser extension exists first

### All-in-One Phase
For rapid prototyping:
- Combine Phase 1.1 + 1.2 into single "Enhanced Vault" phase
- Deploy quickly, iterate based on usage data

---

**Document Version:** 1.0
**Last Updated:** 2026-01-18
**Owner:** Vault Prime Development Team
