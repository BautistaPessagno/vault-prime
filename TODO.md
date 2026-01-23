# Vault Prime - Development TODO List

This document breaks down the roadmap into actionable tasks. Start with Phase 1 and check off items as they're completed.

---

## 🔵 PHASE 1: Core Data Types & Recovery

### 1.1 Secure Notes & Environment Variables ✅ START HERE

#### Database Schema Updates
- [ ] Create database migration file for new columns
- [ ] Add `entry_type` VARCHAR(20) column with default 'password'
- [ ] Add `content` TEXT column for notes and env file data
- [ ] Add `metadata` JSONB column for env file structure
- [ ] Run migration and verify schema changes
- [ ] Create migration to set all existing entries to type 'password'

#### Backend API Changes
- [ ] Update `src/db/schema.ts` with new entry fields
- [ ] Modify entry encryption functions to handle larger content (notes)
- [ ] Update `GET /api/entries` to return new fields
- [ ] Update `POST /api/entries` to accept entry_type, content, metadata
- [ ] Update `PUT /api/entries/[id]` to handle all entry types
- [ ] Add validation for entry_type enum
- [ ] Add validation for env file format (key=value pairs)
- [ ] Test encryption/decryption of large content fields

#### Frontend Components
- [ ] Create `EntryTypeSelector` component (dropdown: Password, Note, Env File)
- [ ] Create `SecureNoteEditor` component (textarea with formatting)
- [ ] Create `EnvFileEditor` component (key-value pair inputs)
- [ ] Add icons for each entry type (lock, note, file)
- [ ] Update entry list to display appropriate icon based on type
- [ ] Add filter dropdown to filter by entry type
- [ ] Update entry detail view to show correct editor based on type
- [ ] Add syntax highlighting for .env files (optional, nice-to-have)

#### UI/UX Polish
- [ ] Update create/edit modal to show type selector
- [ ] Add placeholder text for each editor type
- [ ] Add character count for notes (optional)
- [ ] Add validation messages for env file format
- [ ] Test responsive design for new components
- [ ] Add loading states during save

#### Testing
- [ ] Test creating password entry (existing functionality)
- [ ] Test creating secure note with large content (10KB+)
- [ ] Test creating env file with 20+ variables
- [ ] Test editing all entry types
- [ ] Test deleting all entry types
- [ ] Test search/filter by entry type
- [ ] Test encryption size limits

---

### 1.2 Password Change & Master Key Rotation ⚠️ CRITICAL

#### Planning & Design
- [ ] Document complete password change flow (write spec)
- [ ] Design database transaction strategy
- [ ] Plan error handling and rollback scenarios
- [ ] Design progress indicator UI for large vaults
- [ ] Review security implications (schedule security review)

#### Crypto Implementation
- [ ] Create `rotateEncryptionKey()` utility in `src/lib/entries/crypto.ts`
- [ ] Create `batchDecryptEntries()` function
- [ ] Create `batchEncryptEntries()` function
- [ ] Add transaction wrapper for database operations
- [ ] Test with 1 entry, 10 entries, 100 entries, 1000 entries
- [ ] Measure performance and add optimizations if needed

#### API Endpoint
- [ ] Create `POST /api/auth/change-password` endpoint
- [ ] Validate current password against stored hash
- [ ] Implement full re-encryption flow
- [ ] Add database transaction (BEGIN/COMMIT/ROLLBACK)
- [ ] Add rate limiting (max 3 attempts per hour per user)
- [ ] Invalidate all active sessions after success
- [ ] Send email notification on password change
- [ ] Return progress updates (if using streaming)

#### Frontend UI
- [ ] Create `ChangePasswordModal` component
- [ ] Add "Change Password" button in settings/account section
- [ ] Add current password input field
- [ ] Add new password input field (with strength meter)
- [ ] Add confirm new password field
- [ ] Show progress bar during re-encryption
- [ ] Show success message and force re-login
- [ ] Handle errors (wrong password, network failure, etc.)
- [ ] Add warning message about session invalidation

#### Testing & Validation
- [ ] Test with empty vault (0 entries)
- [ ] Test with small vault (1-10 entries)
- [ ] Test with medium vault (100 entries)
- [ ] Test with large vault (1000+ entries)
- [ ] Test wrong current password rejection
- [ ] Test transaction rollback on database error
- [ ] Test session invalidation
- [ ] Test re-login with new password
- [ ] Test old password no longer works
- [ ] Verify all entries decrypt correctly after change

#### Security Hardening
- [ ] Add audit logging for password change attempts
- [ ] Implement rate limiting in API endpoint
- [ ] Add email verification before allowing password change (optional)
- [ ] Ensure no plaintext data in logs
- [ ] Add monitoring/alerting for failed attempts

---

### 1.3 Account Recovery Mechanism

#### Database Schema
- [ ] Create `recovery_codes` table with schema:
  - `id UUID PRIMARY KEY`
  - `user_id UUID REFERENCES users(id) ON DELETE CASCADE`
  - `code_hash TEXT NOT NULL`
  - `used_at TIMESTAMP`
  - `created_at TIMESTAMP DEFAULT NOW()`
- [ ] Create migration file
- [ ] Run migration

#### Recovery Code Generation
- [ ] Create `generateRecoveryCodes(count)` utility function
- [ ] Generate 10 random 16-character alphanumeric codes
- [ ] Hash codes with Argon2 before storage
- [ ] Store hashed codes in database during signup
- [ ] Return plaintext codes ONCE to user

#### Signup Flow Update
- [ ] Update `POST /api/auth/signup` to generate recovery codes
- [ ] Return codes in response (or store in session for display)
- [ ] Create post-signup page to display recovery codes
- [ ] Add "Download as text file" button
- [ ] Add "Print" button
- [ ] Add "I've saved my recovery codes" checkbox
- [ ] Prevent proceeding without acknowledgment

#### Recovery Flow
- [ ] Create `POST /api/auth/recover-account` endpoint
- [ ] Accept email + recovery code
- [ ] Verify code against hashed codes in DB
- [ ] Mark code as used (set used_at timestamp)
- [ ] Generate temporary token for password reset
- [ ] Create recovery UI page (`/recover-account`)
- [ ] Show email input + recovery code input
- [ ] After verification, show password reset form
- [ ] Allow user to set new master password
- [ ] Re-encrypt all entries with new password (reuse logic from 1.2)
- [ ] Send email notification on recovery attempt

#### Recovery Options
- [ ] Add "Forgot Password?" link on login page
- [ ] Link to recovery flow
- [ ] Add option: "Reset Vault" (delete all entries if can't decrypt)
- [ ] Add confirmation dialog for vault reset
- [ ] Implement vault reset endpoint

#### Testing
- [ ] Test recovery code generation
- [ ] Test recovery code download
- [ ] Test recovery flow with valid code
- [ ] Test recovery flow with invalid code
- [ ] Test recovery flow with used code
- [ ] Test recovery flow with expired code (if expiration added)
- [ ] Test re-encryption after recovery
- [ ] Test email notifications

#### Documentation
- [ ] Document recovery process in user guide
- [ ] Add warning about storing recovery codes safely
- [ ] Create FAQ for recovery scenarios

---

## 🟢 PHASE 2: Secure Sharing Infrastructure

### 2.1 Sharing Architecture Design

#### Research & Planning
- [ ] Research public key cryptography libraries (@noble/curves vs Node crypto)
- [ ] Compare RSA vs Elliptic Curve (ECC) approaches
- [ ] Document chosen approach with rationale
- [ ] Design complete sharing protocol (write specification)
- [ ] Define permission model (view-only, edit, re-share)
- [ ] Plan key rotation strategy
- [ ] Schedule security review/audit

#### Database Schema Design
- [ ] Design `user_keys` table schema
- [ ] Design `shared_entries` table schema
- [ ] Design `share_invitations` table schema
- [ ] Create database migration files
- [ ] Document relationships and constraints

---

### 2.2 Key Pair Generation & Management

#### Implementation
- [ ] Install chosen crypto library
- [ ] Create `generateKeyPair()` function
- [ ] Create `encryptWithPublicKey()` function
- [ ] Create `decryptWithPrivateKey()` function
- [ ] Add key generation to login flow (if keys don't exist)
- [ ] Encrypt private key with user's master password
- [ ] Store public + encrypted private key in database
- [ ] Create `GET /api/keys` endpoint to retrieve user's public key
- [ ] Create key retrieval and decryption utility

#### Key Management UI
- [ ] Show user their public key (fingerprint/hash)
- [ ] Add "Regenerate Keys" button (with warning)
- [ ] Show key creation date
- [ ] Add key export/backup option

#### Migration for Existing Users
- [ ] Create migration script to generate keys for existing users
- [ ] Prompt existing users to confirm key generation on next login
- [ ] Handle users without keys gracefully

#### Testing
- [ ] Test key pair generation
- [ ] Test private key encryption/decryption
- [ ] Test key retrieval from database
- [ ] Test key regeneration
- [ ] Verify key format compatibility

---

### 2.3 Share Entry Implementation

#### Backend API
- [ ] Create `POST /api/entries/[id]/share` endpoint
- [ ] Accept recipient email and permissions
- [ ] Lookup recipient's public key
- [ ] Decrypt entry with owner's key
- [ ] Encrypt entry with recipient's public key
- [ ] Store share in `shared_entries` table
- [ ] Create share invitation in `share_invitations` table
- [ ] Send email notification to recipient
- [ ] Create `GET /api/shares/incoming` endpoint (entries shared with me)
- [ ] Create `GET /api/shares/outgoing` endpoint (entries I've shared)
- [ ] Create `DELETE /api/shares/[id]` endpoint (revoke share)
- [ ] Create `PUT /api/shares/[id]/permissions` endpoint

#### Sharing UI
- [ ] Add "Share" button to entry detail view
- [ ] Create `ShareModal` component
- [ ] Add recipient email input with validation
- [ ] Add permission selector (view-only, edit, re-share)
- [ ] Add expiration date picker (optional)
- [ ] Show list of current shares for entry
- [ ] Add "Revoke" button for each share
- [ ] Create "Shared with Me" section in main dashboard
- [ ] Create "Shared by Me" management view
- [ ] Add visual indicators for shared entries (icon/badge)

#### Permission Enforcement
- [ ] Enforce view-only permissions on edit attempts
- [ ] Enforce edit permissions on update attempts
- [ ] Enforce re-share permissions
- [ ] Add permission checks in all relevant API endpoints

#### Notifications
- [ ] Send email when entry is shared
- [ ] Send email when share is revoked
- [ ] Add in-app notification system (optional)

#### Testing
- [ ] Test sharing entry with another user
- [ ] Test recipient can view shared entry
- [ ] Test recipient can edit (if permission granted)
- [ ] Test recipient cannot edit (if view-only)
- [ ] Test share revocation
- [ ] Test permission updates
- [ ] Test sharing with non-existent user
- [ ] Test sharing multiple entries
- [ ] Test edge cases (large entries, special characters)

---

### 2.4 Share Secure Notes & Environment Variables

#### Backend
- [ ] Update share logic to handle all entry types
- [ ] Test encryption of large notes before sharing
- [ ] Test encryption of env files before sharing

#### Frontend
- [ ] Update share UI to support all entry types
- [ ] Add type-specific icons in share lists
- [ ] Test sharing notes
- [ ] Test sharing env files

#### Advanced Permissions (Optional)
- [ ] Add permission: "View keys only" for env files
- [ ] Add permission: "Download only" for notes

---

## 🟡 PHASE 3: Advanced Authentication - Passkeys

### 3.1 WebAuthn Integration

#### Setup
- [ ] Install `@simplewebauthn/server`
- [ ] Install `@simplewebauthn/browser`
- [ ] Create `passkeys` table in database
- [ ] Create migration

#### Backend Implementation
- [ ] Create `POST /api/auth/passkeys/register-options` endpoint
- [ ] Create `POST /api/auth/passkeys/register-verify` endpoint
- [ ] Create `POST /api/auth/passkeys/login-options` endpoint
- [ ] Create `POST /api/auth/passkeys/login-verify` endpoint
- [ ] Create `GET /api/auth/passkeys` endpoint (list user's passkeys)
- [ ] Create `DELETE /api/auth/passkeys/[id]` endpoint (remove passkey)

#### Frontend - Registration
- [ ] Create passkey registration UI in account settings
- [ ] Add "Add Passkey" button
- [ ] Implement registration ceremony (call browser WebAuthn API)
- [ ] Show success message with device name
- [ ] Allow user to name their passkey (e.g., "iPhone", "YubiKey")

#### Frontend - Authentication
- [ ] Add "Login with Passkey" button on login page
- [ ] Implement authentication ceremony
- [ ] After passkey auth, prompt for master password
- [ ] Derive encryption key from master password
- [ ] Complete login flow

#### Device Management
- [ ] Show list of registered passkeys in settings
- [ ] Show last used date for each passkey
- [ ] Add "Delete" button for each passkey
- [ ] Add device icons (mobile, desktop, hardware key)

#### Testing
- [ ] Test passkey registration on Chrome
- [ ] Test passkey registration on Safari (macOS/iOS)
- [ ] Test passkey registration on Firefox
- [ ] Test passkey login flow
- [ ] Test with multiple passkeys
- [ ] Test passkey deletion
- [ ] Test fallback to password if passkey fails
- [ ] Test on mobile devices (iOS/Android)

#### Documentation
- [ ] Create user guide for passkey setup
- [ ] Document browser compatibility
- [ ] Add troubleshooting guide

---

## 🟠 PHASE 4: Browser Extension

### 4.1 Extension Architecture

#### Project Setup
- [ ] Create `/extension` directory
- [ ] Initialize package.json for extension
- [ ] Set up TypeScript configuration
- [ ] Choose build tool (webpack or vite)
- [ ] Create Manifest V3 file
- [ ] Set up directory structure (background/, content/, popup/, shared/)

#### Build Pipeline
- [ ] Configure webpack/vite for extension build
- [ ] Set up separate builds for Chrome, Firefox, Safari
- [ ] Add build scripts to package.json
- [ ] Configure hot reload for development
- [ ] Add TypeScript compilation

---

### 4.2 Authentication & Sync

#### Authentication
- [ ] Create login UI in popup (React component)
- [ ] Implement API client for vault API
- [ ] Store JWT token in chrome.storage.local (encrypted)
- [ ] Create session management module
- [ ] Add automatic re-authentication on token expiry
- [ ] Implement logout functionality

#### Data Sync
- [ ] Create background service worker for periodic sync
- [ ] Fetch all vault entries from API
- [ ] Encrypt and cache entries in extension storage
- [ ] Add sync interval (e.g., every 5 minutes)
- [ ] Add manual sync button in popup
- [ ] Handle offline mode gracefully

#### Security
- [ ] Encrypt cached vault data
- [ ] Implement session timeout (15 minutes of inactivity)
- [ ] Clear all data on logout
- [ ] Add Content Security Policy (CSP)

---

### 4.3 Autofill Implementation

#### Form Detection
- [ ] Create content script for injection into web pages
- [ ] Detect login forms on page load
- [ ] Use MutationObserver for SPA form detection
- [ ] Identify username and password fields
- [ ] Show Vault Prime icon in detected fields

#### Autofill Logic
- [ ] Create autofill dropdown component
- [ ] Match entries by current page URL
- [ ] Implement fuzzy matching for domains
- [ ] Allow user to search/filter entries
- [ ] Inject username and password on selection
- [ ] Add option to auto-submit form

#### Testing
- [ ] Test on Google login
- [ ] Test on GitHub login
- [ ] Test on Facebook login
- [ ] Test on bank websites
- [ ] Test on multi-step login flows
- [ ] Test on non-standard form fields
- [ ] Test on SPAs (React, Vue, Angular sites)

---

### 4.4 Context Menu & Shortcuts

#### Context Menu
- [ ] Add right-click context menu integration
- [ ] Add "Save to Vault Prime" option
- [ ] Implement save password on form submit detection
- [ ] Add "Copy password" option for selected text

#### Keyboard Shortcuts
- [ ] Register Ctrl+Shift+V (Cmd+Shift+V on Mac) to open popup
- [ ] Add Ctrl+Shift+L to autofill current page
- [ ] Make shortcuts configurable

#### Quick Actions
- [ ] Add quick-copy password to clipboard
- [ ] Add notification toasts for actions
- [ ] Add badge count for autofillable sites

---

### 4.5 Cross-Browser Publishing

#### Preparation
- [ ] Create all required icon sizes (16x16, 32x32, 48x48, 128x128)
- [ ] Capture screenshots for store listings
- [ ] Write extension description (short and long)
- [ ] Create privacy policy page
- [ ] Create terms of service page
- [ ] Prepare promotional images

#### Chrome Web Store
- [ ] Create Chrome Web Store developer account ($5 fee)
- [ ] Create store listing
- [ ] Upload extension package
- [ ] Submit for review
- [ ] Respond to review feedback (if any)
- [ ] Publish

#### Firefox Add-ons
- [ ] Create Firefox developer account
- [ ] Create add-on listing
- [ ] Upload .xpi package
- [ ] Submit for review
- [ ] Publish

#### Microsoft Edge
- [ ] Use Chrome Web Store (Edge uses Chrome extensions)
- [ ] Or submit separately to Edge Add-ons store

#### Documentation
- [ ] Create user installation guide
- [ ] Create usage guide with screenshots
- [ ] Add troubleshooting FAQ

---

## 🔴 PHASE 5: iOS Mobile App

### 5.1 iOS Project Setup

#### Technology Decision
- [ ] Decide: React Native vs Native Swift
- [ ] Document decision with pros/cons
- [ ] Set up development environment

#### React Native Path (if chosen)
- [ ] Initialize React Native project
- [ ] Install react-native-keychain
- [ ] Install react-native-biometrics
- [ ] Configure TypeScript
- [ ] Set up iOS project in Xcode
- [ ] Configure bundle ID (com.vaultprime.app)
- [ ] Set up code signing
- [ ] Configure app icons

#### Native Swift Path (if chosen)
- [ ] Create new Xcode project (SwiftUI)
- [ ] Set up project structure
- [ ] Configure bundle ID
- [ ] Set up code signing
- [ ] Configure app icons
- [ ] Set up CocoaPods or Swift Package Manager

---

### 5.2 Core App Features

#### Authentication
- [ ] Create login screen UI
- [ ] Implement master password input
- [ ] Add biometric authentication (Face ID / Touch ID)
- [ ] Implement API client for vault API
- [ ] Store session token in iOS Keychain
- [ ] Add auto-lock after inactivity

#### Vault UI
- [ ] Create vault list view (UITableView or List)
- [ ] Create entry detail view
- [ ] Add search bar
- [ ] Implement filtering by entry type
- [ ] Add pull-to-refresh
- [ ] Add swipe actions (delete, copy)

#### Entry Management
- [ ] Create entry creation form
- [ ] Create entry edit form
- [ ] Add password generator
- [ ] Implement secure clipboard (auto-clear after 30 seconds)
- [ ] Add copy-to-clipboard with haptic feedback
- [ ] Add delete confirmation dialog

#### Offline & Sync
- [ ] Implement local encrypted storage (Core Data or Realm)
- [ ] Add background sync service
- [ ] Handle network errors gracefully
- [ ] Show sync status indicator
- [ ] Add manual sync button

---

### 5.3 iOS AutoFill Integration

#### Extension Setup
- [ ] Add AutoFill Credential Provider Extension target
- [ ] Configure app group for shared data
- [ ] Set up shared keychain access
- [ ] Configure entitlements

#### AutoFill Implementation
- [ ] Implement CredentialProviderViewController
- [ ] Fetch credentials from shared container
- [ ] Implement authentication in extension (biometric)
- [ ] Build credential selection UI
- [ ] Return selected credential to iOS
- [ ] Handle credential updates

#### Testing
- [ ] Test autofill in Safari
- [ ] Test autofill in third-party apps
- [ ] Test biometric auth in extension
- [ ] Test credential sync between app and extension

---

### 5.4 iOS-Specific Features

#### Share Extension
- [ ] Create Share Extension target
- [ ] Accept shared URLs/credentials
- [ ] Parse login forms from shared content
- [ ] Save to vault

#### Widgets
- [ ] Create widget extension
- [ ] Design small, medium, large widget layouts
- [ ] Show favorite/recent entries (masked)
- [ ] Add quick-copy action

#### Shortcuts
- [ ] Implement Siri Shortcuts support
- [ ] Add "Get Password" shortcut
- [ ] Add "Generate Password" shortcut

#### Other
- [ ] Support dark mode
- [ ] Add haptic feedback throughout
- [ ] Implement 3D Touch quick actions
- [ ] Add Face ID/Touch ID for app launch
- [ ] Support iPad layouts (split view, slide over)

---

### 5.5 App Store Submission

#### Preparation
- [ ] Create app preview video
- [ ] Capture screenshots (all device sizes: iPhone SE, Pro, Pro Max, iPad)
- [ ] Write app description
- [ ] Create privacy policy URL
- [ ] Prepare keywords for ASO
- [ ] Create support URL

#### App Store Connect
- [ ] Create app record in App Store Connect
- [ ] Upload app binary via Xcode
- [ ] Fill in app information
- [ ] Add screenshots and preview
- [ ] Set pricing (free)
- [ ] Answer export compliance questions
- [ ] Submit for review

#### Post-Submission
- [ ] Monitor review status
- [ ] Respond to review feedback quickly
- [ ] Fix any rejection issues
- [ ] Resubmit if needed
- [ ] Publish and announce

---

## Quick Start Guide

### Recommended First Steps (Week 1)

1. **Day 1-2:** Set up Phase 1.1 database schema
2. **Day 3-4:** Implement secure notes backend + API
3. **Day 5:** Build secure notes UI
4. **Day 6-7:** Implement .env file editor

### Week 2-3: Complete Phase 1

Continue with password change implementation and recovery codes.

---

## Development Best Practices

### Before Starting Each Task
- [ ] Read related code files
- [ ] Understand existing patterns
- [ ] Write tests first (TDD approach)

### During Development
- [ ] Commit frequently with clear messages
- [ ] Test manually after each change
- [ ] Run automated tests
- [ ] Check TypeScript errors

### After Completing Task
- [ ] Mark task as complete in this file
- [ ] Update ROADMAP.md if approach changed
- [ ] Document any decisions made
- [ ] Create pull request for review

---

## Notes Section

Use this space for quick notes, decisions, or blockers:

```
[Add your notes here as you work]

Example:
- 2026-01-18: Decided to use @noble/curves for ECC instead of RSA (smaller keys)
- 2026-01-20: Discovered issue with large content encryption, need to optimize
```

---

**Start Date:** [Add when you begin]
**Target Completion:** [Add your goal date]
**Current Phase:** Phase 1.1 (Secure Notes & Env Variables)
