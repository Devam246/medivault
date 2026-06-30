# MediVault — CHANGELOG

Append-only log of every change made to the project. Never overwrite or delete entries.
Format: date, version, files changed, why, how verified, any deviations.

---

## Session — 2026-06-30 — Branch: harsh

### Pre-Work — Created required docs/ files
- **What:** Created `docs/CHANGELOG.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATE.md`
- **Why:** Handbook §7 requires these files to exist before any other work. They were all missing.
- **Verified:** Files created in `docs/` directory.

---

### v1.0 Step 1 — Remove disabled TLS verification
- **What changed:**
  - `backend/blockchain/blockchain.js`: Removed `import https from "https"` and replaced `new Web3.providers.HttpProvider(rpcUrl, { agent: new https.Agent({ rejectUnauthorized: false }) })` with plain `new Web3.providers.HttpProvider(rpcUrl)`
  - `backend/server.js`: Deleted `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` (line 14)
- **Why:** v1.0 Step 1. These lines disabled TLS certificate validation globally for all HTTPS connections, including blockchain RPC calls and any other outbound HTTPS from the backend — a critical security hole in any environment.
- **Verified:** Grep scan of entire codebase confirms zero remaining instances of `NODE_TLS_REJECT_UNAUTHORIZED` or `rejectUnauthorized: false` in any code file. `context.md` contains a reference in documentation text only (not code).

---

### v1.0 Step 2 — Stop logging credentials
- **What changed:**
  - `backend/config/db.js`: Replaced 5-line `console.log` block (printing ENV CHECK, host, user, password, DB name) with a single safe line: `console.log("DB connecting to:", process.env.DB_HOST)`
- **Why:** v1.0 Step 2. DB user and password were being printed to stdout on every server start — visible in terminal, server logs, and any log aggregation system.
- **Verified:** Grep scan of entire `backend/` for credential-containing `console.log` patterns. Only hits in `scripts/seedTestDoctor.js` and `scripts/seedDemoData.js` — these intentionally print the seed password for developer use after seeding (dev-only scripts, not production code). No further action needed.

---### v1.0 Step 3 — Create config/env.js secrets abstraction
- **What changed:**
  - **[NEW]** `backend/config/env.js`: Created with named getters `getJwtSecret()`, `getDbPass()`, `getPrivateKey()`, `getGroqApiKey()` — all reads validate the env var is present and throw if missing
  - `backend/middleware/auth.js`: Replaced `process.env.JWT_SECRET` with `getJwtSecret()`, removed direct dotenv import
  - `backend/controllers/authController.js`: Replaced `process.env.JWT_SECRET` with `getJwtSecret()`, removed direct dotenv import
  - `backend/controllers/apiAuthController.js`: Replaced `process.env.JWT_SECRET` with `getJwtSecret()`
  - `backend/blockchain/blockchain.js`: Replaced `process.env.PRIVATE_KEY` with `getPrivateKey()`
  - `backend/controllers/ragController.js`: Replaced `process.env.GROQ_API_KEY` with `getGroqApiKey()`, `process.env.DB_PASS` with `getDbPass()`
- **Why:** v1.0 Step 3. Centralizing secret reads means v2.0's swap to AWS Secrets Manager only touches `env.js`, not every file that needs a secret. Also enforces that missing secrets fail loudly at call time rather than silently using undefined.
- **Verified:** Grep scan for `process.env.(JWT_SECRET|PRIVATE_KEY|DB_PASS|GROQ_API_KEY)` in backend `*.js` files. Only remaining hits are in `config/env.js` (the abstraction layer itself) and `config/db.js` (MySQL pool setup — correct location) and a seed script (dev-only, acceptable).

---

### v1.0 Step 4 — Standardize password hashing on Argon2
- **What changed:**
  - `backend/controllers/authController.js`: Added `import bcrypt` for migration use only. Rewrote `login()` to detect bcrypt hashes (`$2b$`/`$2a$` prefix), verify with bcrypt once, then re-hash with Argon2 and persist. Pure Argon2 hashes use the existing path unchanged.
  - `backend/controllers/apiAuthController.js`: Deleted all bcrypt code (`import bcrypt`, `SALT_ROUNDS`, `bcrypt.hash`, `bcrypt.compare`). `register()` now uses `argon2.hash()`; `login()` now uses `argon2.verify()`.
- **Why:** v1.0 Step 4. Two parallel auth systems existed — `authController.js` (Argon2) and `apiAuthController.js` (bcrypt). The migration path handles any legacy bcrypt-hashed rows automatically on next login.
- **Verified:** Grep for `import bcrypt` across backend — only one hit in `authController.js`, clearly annotated as migration-only. No `bcrypt.hash` or `bcrypt.compare` outside the migration block.

---

