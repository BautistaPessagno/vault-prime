# Vault Prime

A secure, self-hosted password manager built with Next.js and modern cryptographic standards.

## Features

- **Secure Password Storage**: End-to-end encrypted password vault entries
- **Strong Encryption**: AES-256-GCM encryption with HKDF key derivation
- **Argon2 Hashing**: Industry-standard password hashing with Argon2id
- **User Authentication**: JWT-based authentication system
- **Entry Management**: Store and manage password entries with metadata (name, username, password, URL)
- **Usage Tracking**: Track last edited and last copied timestamps for entries

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL with Drizzle ORM
- **Cryptography**:
  - `@noble/ciphers` for AES-256-GCM encryption
  - `@noble/hashes` for HKDF and SHA-256
  - `argon2` for password hashing
- **Authentication**: JWT with `jose` library

## Security

Vault Prime implements multiple layers of security:

- **Argon2id** password hashing with 64 MiB memory cost
- **AES-256-GCM** authenticated encryption for vault entries
- **HKDF** (HMAC-based Key Derivation Function) with SHA-256
- **Master password** architecture - never stored in plaintext
- **Cascade deletion** - entries are automatically deleted when users are removed

## Getting Started

### Prerequisites

- Node.js 20 or higher
- PostgreSQL database
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vault-prime.git
cd vault-prime
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with your PostgreSQL connection string and other required variables.

4. Run database migrations:
```bash
npx drizzle-kit push
```

5. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## API Routes

- **Authentication**
  - `POST /api/auth/signup` - Create a new user account
  - `POST /api/auth/login` - Authenticate and receive JWT token
  - `POST /api/auth/logout` - Invalidate current session

- **Vault Entries**
  - `GET /api/entries` - Retrieve all entries for authenticated user
  - `POST /api/entries` - Create a new vault entry
  - `GET /api/entries/[id]` - Get a specific entry
  - `PUT /api/entries/[id]` - Update an entry
  - `DELETE /api/entries/[id]` - Delete an entry
  - `POST /api/entries/[id]/copied` - Update last copied timestamp

## Database Schema

### Users Table
- `id` (UUID) - Primary key
- `email` (text) - Unique user email
- `master_password_hash` (text) - Argon2 hashed master password
- `created_at` (timestamp) - Account creation timestamp

### Entries Table
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users table
- `name` (text) - Entry name/title
- `user` (text) - Username for the entry
- `password` (text) - Encrypted password
- `url` (text) - Associated URL
- `updated_at` (timestamp) - Last edit timestamp
- `copied_at` (timestamp) - Last copy timestamp

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint
```

## License

Private project - All rights reserved

## Contributing

This is a private project. Contributions are not currently accepted.
