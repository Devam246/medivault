# MediVault — Detailed Execution Guide (IDE-Ready)

This document expands the original roadmap into a fully procedural, step-by-step guide. Every version below is self-contained: it lists exact files to touch, exact actions to take, and an exact Definition of Done. It is written so that an IDE/coding agent can read a single version section and execute it without needing outside context.

**Rule for every version: do not start the next version until every Definition of Done checkbox in the current version is checked.**

---

## VERSION INDEX

- v1.0 — Security & Broken Routes (Stop the Bleeding)
- v1.1 — Folder Restructure & Clean Code
- v1.2 — Architecture Hardening (DB, transactions, validation)
- v2.3 — Database Modernization (MySQL → MongoDB)
- v1.3 — Testing Foundation
- v2.0 — Dockerize + AWS Deployment
- v2.1 — Blockchain Restructure & Advisory
- v2.2 — System Design Upgrades (queues, caching, scaling)
- v3.0 — Frontend Polish

> Note: v2.3 is intentionally scheduled before v1.3 and v2.0 so the project does not lock in MySQL-based testing and deployment before the database migration is completed.

---

## v1.0 — Security & Broken Routes ("Stop the Bleeding")

**Goal:** Close every active security hole and fix every route/feature that currently lies about working. Nothing else gets touched in this version.

**Do not**: rename folders, move files between directories, or refactor unrelated code in this version. Keep diffs narrow.

### Step 1 — Remove disabled TLS verification

- Open `blockchain/blockchain.js`.
- Find and delete the line: `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'`.
- Run the existing blockchain anchoring call against the Sepolia RPC provider (Infura/Alchemy) with TLS verification on.
- If the call fails due to a certificate error, fix the actual certificate chain (e.g., update CA bundle / Node version) — do **not** re-add the disable flag.
- Confirm the transaction hash returned matches a real Sepolia transaction by checking it on a block explorer.

### Step 2 — Stop logging credentials

- Open `config/db.js`.
- Find the line logging the full config object, e.g. `console.log('Database config:', {host, user, password})`.
- Replace it with: `console.log('DB connected:', host)` — log host only, never user or password.
- Search the entire backend codebase for any other `console.log` that prints an object containing `password`, `pass`, `secret`, `key`, or `token`, and redact those too.

### Step 3 — Tier the secrets

- Create a new file: `config/env.js`.
- In `config/env.js`, build a config loader that reads from `process.env` and exposes named getters (e.g. `getJwtSecret()`, `getDbPass()`, `getPrivateKey()`, `getGroqApiKey()`), rather than every file reading `process.env.X` directly.
- Keep `.env` for non-sensitive values only: `PORT`, `NODE_ENV`, `FRONTEND_URL`.
- Treat `JWT_SECRET`, `PRIVATE_KEY`, `DB_PASS`, `GROQ_API_KEY` as sensitive — route all reads of these through `config/env.js`, not raw `process.env` calls scattered across files.
- This abstraction is required now because v2.0 will swap the underlying source to AWS Secrets Manager — the abstraction layer means that swap touches one file, not the whole codebase.

### Step 4 — Standardize password hashing on Argon2

- Identify the two parallel auth implementations: `authController.js` (Argon2) and `apiAuthController.js` (bcrypt).
- Delete the bcrypt code path in `apiAuthController.js` entirely. Do not keep it as a fallback.
- For any existing user rows hashed with bcrypt, implement a rehash-on-login migration:
  - On successful login, check which hash format the stored password uses.
  - If bcrypt, verify with bcrypt once, then immediately re-hash the plaintext password with Argon2 and update the user's row.
  - If Argon2, verify normally — no migration needed.
- Confirm no remaining imports of `bcrypt` exist anywhere outside this migration helper.

### Step 5 — Add rate limiting to auth endpoints

- Install `express-rate-limit` if not already present.
- Create middleware (e.g. `middleware/rateLimiter.js`) configured for:
  - 5 attempts per 15 minutes, keyed by IP (optionally IP+email to avoid locking out shared-office IPs).
- Apply this middleware to `/auth/login` and `/auth/refresh` routes only.
- Manually test: trigger 6 rapid login attempts and confirm the 6th is rejected with a clear rate-limit error.

### Step 6 — Fix `/patient/search`

- Open the controller handling `/patient/search`.
- Remove the dependency on `req.app.get('db')`.
- Import the database pool directly from `config/db.js`, matching the pattern already used by every other controller.
- Test the endpoint manually and confirm it returns real results instead of erroring.

### Step 7 — Fix role-based redirect mismatches

- Open `RequireAuth.jsx`.
- Change `navigate('/doctor-dashboard')` → `navigate('/doctor')`.
- Change `navigate('/admin-dashboard')` → `navigate('/admin')`.
- Grep the entire frontend codebase for any other `-dashboard` suffix used inside a `navigate(...)` call (not inside route `<Route path=...>` definitions — only navigation calls).
- Fix every instance found, not just the one in `RequireAuth.jsx`.
- Manually test login as each role (patient, doctor, admin) and confirm each lands on the correct route with zero redirect loops.

### Step 8 — Mount Admin routes (backend currently missing)

- Create `backend/controllers/adminController.js` with the following functions:
  - `getDoctorList(req, res)` → `GET /admin/doctors?status=pending`
  - `approveDoctor(req, res)` → `POST /admin/doctors/:id/approve`
  - `rejectDoctor(req, res)` → `POST /admin/doctors/:id/reject`
  - `getSystemStats(req, res)` → `GET /admin/stats` (returns counts of users, records, appointments)
- `approveDoctor` must set `is_verified = 1` on the corresponding `users` row.
- Create `backend/routes/adminRoutes.js`:
  - Wire all four functions above to their routes.
  - Protect every route behind a `requireRole('admin')` middleware check.
- In `backend/server.js`, mount the routes: `app.use('/admin', authenticateToken, adminRoutes)`.
- Manually test the full flow through the existing `AdminDashboard.jsx` UI: view pending doctors → approve one → confirm it now appears as verified in patient search.

### Step 9 — Resolve `AuthContext.jsx`

- Decide definitively: keep `AuthContext.jsx` as the single source of truth, OR delete it.
- **Recommended path: keep it.** It is React-idiomatic and avoids prop drilling once `PatientDashboard.jsx` is split apart in v1.1.
- If keeping it:
  - Wire `AuthContext.jsx` into `main.jsx` so the entire app is wrapped in the auth provider.
  - Search every component currently reading `localStorage` directly for auth/token/role data and replace those reads with the `useAuth()` (or equivalent) hook from context.
- If deleting it:
  - Remove the file and any imports referencing it.
  - Confirm localStorage-based helper functions are consistently used everywhere instead.
- There must be no half-state — every component uses the same auth source.

### Definition of Done — v1.0

- [x] `NODE_TLS_REJECT_UNAUTHORIZED = '0'` does not appear anywhere in the codebase
- [x] No `console.log` anywhere prints a credential, password, secret, or key value
- [x] Only Argon2 is used for password hashing; bcrypt code path is deleted
- [x] `express-rate-limit` is active on `/auth/login` and `/auth/refresh`
- [x] `/patient/search` returns real results, not an error
- [x] All role-based redirects land on real, existing routes with zero redirect loops
- [x] Admin can view pending doctors, approve, and reject — end to end through the UI
- [x] `AuthContext` is either fully wired into `main.jsx` or fully removed — no mixed state

---

## v1.1 — Folder Restructure & Clean Code

**Goal:** Move from an informal single-root layout to a clean `apps/` monorepo structure, and remove all dead code, before Docker (v2.0) makes the entrypoint locations harder to change.

**Precondition:** v1.0 Definition of Done is fully checked.

### Step 1 — Create the target folder structure

Create the following structure (move, don't duplicate, existing files into it):

```
medivault/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/        (db.js, env.js)
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── middleware/    (auth.js, rateLimiter.js, errorHandler.js)
│   │   │   ├── blockchain/
│   │   │   ├── models/        (new — repository layer, built in v1.2)
│   │   │   ├── utils/
│   │   │   └── server.js
│   │   ├── scripts/
│   │   ├── migrations/        (new — built in v1.2)
│   │   ├── tests/             (new — built in v1.3)
│   │   ├── uploads/           (gitignored)
│   │   ├── package.json
│   │   └── Dockerfile         (new — built in v2.0)
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── context/
│   │   │   ├── components/
│   │   │   │   ├── auth/
│   │   │   │   ├── layout/
│   │   │   │   ├── patient/
│   │   │   │   ├── doctor/    (new)
│   │   │   │   └── shared/    (new)
│   │   │   ├── pages/
│   │   │   ├── hooks/         (new)
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── tests/             (new — built in v1.3)
│   │   ├── package.json
│   │   └── Dockerfile         (new — built in v2.0)
│   └── rag-service/
│       ├── app.py
│       ├── medical_summary.py
│       ├── requirements.txt
│       └── Dockerfile         (new — built in v2.0)
├── docs/                      (move all *.md analysis docs here)
├── docker-compose.yml         (new — built in v2.0)
├── .github/workflows/         (new — built in v1.3/v2.0)
└── README.md                  (rewritten)
```

- Move backend source into `apps/backend/src/`.
- Move frontend source into `apps/frontend/src/`.
- Move RAG Python files into `apps/rag-service/`.
- Move every analysis/markdown doc (`CODE_QUALITY_REPORT.md`, `ARCHITECTURE.md`, `PROJECT_OVERVIEW.md`, `TODO_RECOMMENDATIONS.md`, `DEPENDENCY_GRAPH.md`, `CONFIGURATION.md`, etc.) into `docs/`.
- After moving, fix every relative import path that broke as a result (this is the step most likely to silently fail — verify by running both apps).

### Step 2 — Delete dead and duplicate code

- Delete `apiTestController.js`.
- Delete `apiTestRoutes.js`.
- Delete `apiAuthRoutes.js`.
- Delete `apiAuthController.js` (confirm first that the bcrypt migration from v1.0 Step 4 is complete and nothing still depends on this file).
- Search the codebase for any remaining imports of these four files and remove them.

### Step 3 — Rename package identifiers

- In `apps/backend/package.json`, change the `"name"` field to `"medivault-backend"`.
- In `apps/frontend/package.json`, change the `"name"` field to `"medivault-frontend"`.

### Step 4 — Split the `PatientDashboard.jsx` god-component

- Current file is ~500 lines. Split it into six child components:
  - `PatientProfileSection`
  - `MedicalRecordsSection`
  - `AppointmentsSection`
  - `PrescriptionsSection`
  - `VitalSignsSection`
  - `HealthChatSection`
- `PatientDashboard.jsx` itself should be reduced to a layout/orchestrator component only.
- Preferred pattern: each section fetches its own data via a dedicated custom hook (`useMedicalRecords()`, `useAppointments()`, etc.) placed in `apps/frontend/src/hooks/`, so each section is independently testable in v1.3.
- Place the new section components in `apps/frontend/src/components/patient/`.

### Step 5 — Centralize canned RAG responses

- Currently duplicated in `PatientHealthChat.jsx` and `medical_summary.py`.
- Choose one canonical source:
  - Fast option: a single JSON file checked into `apps/rag-service/`, read by both the frontend and the Python service.
  - Better long-term option: a `canned_responses` DB table so admins can edit responses without a redeploy.
- Update both `PatientHealthChat.jsx` and `medical_summary.py` to read from the single chosen source — remove the duplicated copy.

### Step 6 — Establish one consistent controller/error pattern

- Every backend controller function should follow the shape: `async function name(req, res, next)`.
- On failure, controllers call `next(err)` — they do not write ad-hoc `res.status(500).json(...)` with inconsistent response shapes.
- Create `apps/backend/src/middleware/errorHandler.js`: a single middleware mounted last in `server.js` that normalizes every error response to `{success: false, message, code}`.
- Refactor every existing controller to follow this pattern.

### Step 7 — Rewrite the README

- Replace the generic Vite-template `README.md` with one that covers:
  - One paragraph describing what MediVault is.
  - Local dev setup steps: clone → install → env setup → run migrations → seed data → run dev servers.
  - A link to `docs/ARCHITECTURE.md` for deeper detail.
- Keep the README itself short; detailed docs live in `docs/`.

### Definition of Done — v1.1

- [x] Repo is split into `apps/backend`, `apps/frontend`, `apps/rag-service`
- [x] All dead/duplicate controller and route files are removed
- [x] `PatientDashboard.jsx` is under 150 lines and split into six section components
- [x] Every backend controller uses the same error-handling pattern via `errorHandler.js`
- [x] README reflects the actual project, not Vite boilerplate
- [x] `npm run dev:frontend` and `npm run dev:backend` work after the move (verify locally)

---

## v1.2 — Architecture Hardening

**Goal:** Make existing features *correct*, not just present — fix the database integrity gaps, race conditions, and missing validation before deployment.

**Precondition:** v1.1 Definition of Done is fully checked.

### Step 1 — Introduce database migrations

- Create `apps/backend/migrations/`.
- Add numbered SQL migration files starting with `001_init_schema.sql`, `002_add_indexes.sql`, etc.
- Pick one lightweight migration tool (e.g. `db-migrate`) or a small hand-rolled runner that tracks applied migrations in a `schema_migrations` table — do not introduce Knex/Prisma-scale tooling for this schema size.
- Ensure migrations can run automatically on container start (this will be used by `docker-compose up` in v2.0).
- Verify: a completely fresh, empty database can be brought to full schema using only the migration files — no manual SQL required.

### Step 2 — Wrap file upload in a real transaction

- Current pipeline: disk write → blockchain call → JSON log append → MySQL insert, with no rollback on partial failure.
- New required order:
  1. Write file to disk.
  2. Insert the DB row inside a transaction: `connection.beginTransaction()` → `commit()` / `rollback()`.
  3. On success, kick off blockchain anchoring as a background step (not blocking the request) that updates the record's `transaction_hash` column once the chain confirms.
- In the `catch` block, explicitly clean up: delete the disk file and remove the `records.json` entry if the DB insert fails.
- The blockchain call itself is append-only and cannot be rolled back — that's why it now happens after the DB transaction succeeds, asynchronously.

### Step 3 — Fix the appointment double-booking race condition (TOCTOU)

- Run migration: `ALTER TABLE appointments ADD UNIQUE(doctor_id, appointment_date, appointment_time);`
- In the booking controller, catch the `ER_DUP_ENTRY` error and return a clean "slot already booked" response to the client.
- Do not use `SELECT ... FOR UPDATE` for this — the unique constraint approach avoids holding a row lock across the request and works correctly under connection pool pressure.
- Test: attempt to book the same slot from two concurrent requests and confirm exactly one succeeds.

### Step 4 — Add missing indexes

- Add indexes (via a new numbered migration file) to:
  - `users.email`
  - `users.role`
  - every foreign key column on `appointments`, `medical_records`, `prescriptions`, `vital_signs`, `refresh_tokens`, `patient_access_tokens`

### Step 5 — Fix refresh token lookup performance

- Change refresh token lookup from a full-table scan to an indexed query: `WHERE user_id = ?`.
- Confirm the relevant column is covered by the index added in Step 4.

### Step 6 — Add pagination to large list endpoints

- Add pagination (limit/offset or cursor-based) to `getPatientHistory` and any other endpoint that currently fetches an entire table's worth of rows.

### Step 7 — Add a timeout to the Python RAG subprocess

- In the Node code that spawns the Python RAG process, add a hard timeout of 30 seconds.
- On timeout, kill the subprocess and return a clean error response to the client instead of holding the Express request open indefinitely.

### Step 8 — Add an input validation layer

- Install `zod` or `express-validator`.
- Add a validation schema at the route level for every `POST` and `PUT` endpoint.
- Validation should reject malformed requests before they reach controller logic — this also makes the v1.3 test suite meaningful, since tests will exercise real validation logic instead of relying on DB constraints to catch bad input.

### Step 9 — Add centralized audit logging

- Create an `access_logs` table (new migration file).
- Log, at minimum, the following events: doctor views patient history (normal access and token-based access), record upload, record delete, prescription creation.
- Each log entry should capture: who accessed, what was accessed, when, and via which mechanism (normal session vs. access token).

### Step 10 — Introduce a repository/data-access layer

- Create `apps/backend/src/models/` (e.g. `userRepository.js`, `appointmentRepository.js`).
- Each repository wraps raw SQL queries behind named functions, e.g. `userRepository.findByEmail(email)`.
- Refactor controllers to call repository functions instead of writing inline `db.query(...)` calls.
- This refactor should be mechanical at this codebase size — not a rewrite. It directly enables mocking the repository layer in v1.3 instead of mocking MySQL.

### Step 11 — Decide the async job execution model

- Decide explicitly: in-process polling (e.g. `setTimeout`-based queue) for the current scale, vs. a real job queue (BullMQ + Redis, deferred to v2.2).
- For v1.2, in-process polling is sufficient — do not add Redis yet.
- Document this decision in `docs/ARCHITECTURE.md`.

### Definition of Done — v1.2

- [ ] Migrations exist and a fresh database can be built from them alone
- [ ] File upload is transactional; a failed blockchain anchor does not leave an orphaned DB row or orphaned file
- [ ] Appointment double-booking is impossible — verified by attempting it twice in parallel
- [ ] All foreign key columns are indexed
- [ ] Refresh token lookup uses an indexed query, not a full scan
- [ ] Python subprocess calls have a hard timeout
- [ ] Every POST/PUT route validates its input
- [ ] `access_logs` table exists and is written to on every sensitive read/write
- [ ] `userRepository` and `appointmentRepository` exist and are used by their respective controllers

---

## v1.3 — Testing Foundation

**Goal:** Build a real test pyramid (unit → integration → E2E) wired into CI, targeting at minimum the auth, booking, and file upload flows.

**Precondition:** v2.3 Definition of Done is fully checked. This version should not start until the MongoDB-backed data layer is in place, otherwise the test suite will bake in MySQL-specific assumptions.

### Step 1 — Unit tests (Jest, backend)

- Create the following test files under `apps/backend/tests/unit/`:
  - `repositories/userRepository.test.js`
  - `repositories/appointmentRepository.test.js`
  - `utils/generateTimeSlots.test.js`
  - `utils/normalizeQuery.test.js`
  - `middleware/auth.test.js`
- Use Jest with either mocked `mysql2` calls or a real ephemeral test DB via Docker (preferred for repository tests, since it catches real SQL syntax errors that mocks would miss).

### Step 2 — Integration tests (Jest + Supertest, backend)

- Create the following test files under `apps/backend/tests/integration/`:
  - `auth.test.js` — covers register, login, refresh, and confirms rate-limiting triggers after 5 attempts
  - `appointments.test.js` — covers booking, double-booking rejection, cancellation, slot generation
  - `fileUpload.test.js` — covers upload success, confirms DB row matches blockchain transaction, confirms rollback on failure
  - `admin.test.js` — covers the full doctor approval flow end-to-end
- Spin up a disposable database instance for the active storage layer (MongoDB after v2.3; only use MySQL for legacy compatibility smoke tests), run the migration/setup steps against it, run tests, then destroy the container. Never run integration tests against the dev or prod database.
- Mock the blockchain call and the Groq/Python subprocess call in all integration tests using `jest.mock()` for `blockchain.js`, and stub at the `child_process.spawn` boundary for the Python call. CI should never depend on Sepolia testnet uptime or consume real Groq quota.
- Real (non-mocked) blockchain/Groq calls belong in a separate, manually-triggered smoke-test suite — not the main CI gate.

### Step 3 — Frontend component tests (React Testing Library)

- Create the following test files under `apps/frontend/tests/`:
  - `components/RequireAuth.test.jsx` — confirms correct redirect per role (regression guard for the v1.0 redirect bug)
  - `components/PatientHealthChat.test.jsx` — covers canned response matching, loading state, error state
  - `pages/Login.test.jsx` — covers form validation and confirms the correct endpoint is called on submit

### Step 4 — E2E tests (Cypress)

- Create the following spec files under `apps/frontend/cypress/e2e/`:
  - `auth-flow.cy.js`:
    - register as patient → login → lands on `/patient-dashboard`
    - register as doctor → login → lands on `/doctor` (regression guard for the redirect bug)
    - wrong role attempts `/admin` → redirected, not crashed
  - `appointment-flow.cy.js`:
    - patient books a slot → doctor sees it in dashboard → doctor confirms → patient sees status change
    - two browser sessions attempt the same slot → one is cleanly rejected
  - `record-upload-flow.cy.js`:
    - patient uploads a file → record appears in list → blockchain transaction hash is present
  - `easy-access-flow.cy.js`:
    - patient generates an access token → doctor redeems it → sees patient history → token expires after its window
  - `admin-approval-flow.cy.js`:
    - admin sees a pending doctor → approves → doctor now appears in patient search
- Run Cypress against a `docker-compose`'d full stack. If Docker isn't ready yet, it's acceptable to reorder and complete v2.0's Docker setup first — but the security/structure work in v1.0–v1.2 must still come before either.

### Step 5 — Wire CI

- Create `.github/workflows/test.yml`.
- Trigger on `pull_request` and `push` to `main`.
- Jobs:
  - `backend-unit`: runs `npm test` (unit tests only, fast, every push)
  - `backend-integration`: spins up a MySQL service container, runs migrations, runs `npm run test:integration`
  - `frontend-unit`: runs the React Testing Library suite
  - `e2e`: runs `docker-compose up`, waits for healthy containers, then runs `npx cypress run` (can be scheduled nightly instead of every push if CI minutes are constrained)
- Configure CI to block merge on any failing test.

### Definition of Done — v1.3

- [ ] Backend unit test coverage on repositories and utils is at least 60%
- [ ] Integration tests cover auth, appointments, file upload, and admin approval
- [ ] The `RequireAuth` redirect bug has a permanent regression test
- [ ] One Cypress E2E spec exists per core user journey (auth, booking, upload, easy access, admin)
- [ ] CI runs all of the above on every PR, and broken tests block merge

---

## v2.0 — Dockerize + AWS Deployment

**Goal:** Containerize every service and deploy to AWS using the smallest production-real footprint.

**Precondition:** v2.3 and v1.3 Definition of Done are fully checked. Deployment should only happen after the database migration work is complete and tested.

### Step 1 — Write the Dockerfiles

**`apps/backend/Dockerfile`**
- Base image: `node:20-alpine`
- Set `WORKDIR /app`
- Copy `package*.json`, run `npm ci --omit=dev`
- Copy the rest of the source
- `EXPOSE 4000`
- `CMD ["node", "src/server.js"]`

**`apps/rag-service/Dockerfile`**
- Base image: `python:3.11-slim`
- Set `WORKDIR /app`
- Copy `requirements.txt`, run `pip install --no-cache-dir -r requirements.txt`
- Copy the rest of the source
- `CMD ["python", "app.py"]`
- Note: if the current architecture still uses Node `spawn()` to call Python directly (rather than HTTP), keep Python bundled inside the backend image via a multi-stage Dockerfile (installing both Node and Python) for the fast path. Only split into a separate container once the IPC mechanism is changed to HTTP (this happens in v2.2).

**`apps/frontend/Dockerfile`** (multi-stage)
- Stage 1 (`node:20-alpine`): `WORKDIR /app`, copy `package*.json`, `npm ci`, copy source, `npm run build`
- Stage 2 (`nginx:alpine`): copy `/app/dist` from the build stage into `/usr/share/nginx/html`, `EXPOSE 80`

**`docker-compose.yml`** (project root)
- Services: `mysql`, `backend`, `frontend`
- `mysql`: image `mysql:8`, env `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD` from `${DB_PASS}`, volume `mysql-data:/var/lib/mysql`
- `backend`: build from `./apps/backend`, `env_file: ./apps/backend/.env`, `depends_on: [mysql]`, port `4000:4000`
- `frontend`: build from `./apps/frontend`, port `80:80`, `depends_on: [backend]`

### Step 2 — Choose the AWS deployment shape

**Option A — Fastest to ship (recommended for an initial deploy): Single EC2 + Docker Compose + RDS**
- Provision one EC2 instance (`t3.small` is sufficient to start), install Docker + Docker Compose.
- Provision RDS MySQL (do not run MySQL in a container in production — managed DB is safer and barely more setup). A `db.t3.micro` is covered by free tier for a year.
- Point `docker-compose.yml`'s DB environment variables at the RDS endpoint; remove the local `mysql` service from the production compose file.
- Deploy process: `git pull` + `docker-compose up -d --build` on the box.
- Attach an Elastic IP to the instance, point the domain's A record at it.
- Terminate TLS with Caddy or nginx + Let's Encrypt running as another container in the compose file (Caddy requires less config — auto-HTTPS in roughly 5 lines).
- Store secrets (`JWT_SECRET`, `PRIVATE_KEY`, `DB_PASS`, `GROQ_API_KEY`) in AWS Secrets Manager or SSM Parameter Store. Inject them into the EC2 instance's environment at boot via a startup script — never commit them to a `.env` file on disk.

**Option B — More correct, more setup: ECS Fargate + RDS + S3 + ALB**
- Push images to ECR; run them as ECS Fargate tasks (no EC2 management, scales by task count).
- Place an Application Load Balancer in front, terminating TLS via a free, auto-renewing ACM certificate.
- Use RDS MySQL, same as Option A.
- Use S3 for the `/uploads` directory instead of container-local disk — this is mandatory in Fargate, since containers are ephemeral. This requires swapping `multer`'s disk storage engine for `multer-s3` in `fileRoutes.js` — a contained, single-file change.
- Set up CI/CD via GitHub Actions: on merge to `main`, build images, push to ECR, force a new ECS deployment.

**Recommendation:** Ship Option A first to get a real deployment live quickly, but make the S3-instead-of-local-disk change regardless of which option is chosen — local disk on an EC2 instance does not survive instance replacement or resizing, which would silently lose uploaded medical records. Migrate from A to B only when an actual scaling wall is hit.

### Step 3 — (Optional) Backend-only fast path

- If only the API needs to be live first: deploy `backend` + `mysql` only, and run the frontend locally pointed at the deployed API URL.
- Fix the hardcoded `localhost:4000` value in `axiosClient.js` so `VITE_API_URL` is always read from an environment variable — this should be done regardless of deployment path, since it's what makes a split deploy trivial.

### Definition of Done — v2.0

- [ ] All three services (backend, frontend, rag-service) have working Dockerfiles
- [ ] `docker-compose up` reproduces the full stack locally, matching production behavior
- [ ] Secrets are not committed to git and are not stored in plaintext on the deployed instance
- [ ] The database is RDS, not a container, even on the fast path
- [ ] File uploads survive a server restart (S3 or persistent volume, not ephemeral container disk)
- [ ] HTTPS is enforced; no plain HTTP in production
- [ ] `VITE_API_URL` and equivalent backend `FRONTEND_URL` are environment-driven, not hardcoded

---

## v2.1 — Blockchain Restructure & Advisory

**Goal:** Document the current blockchain design honestly, fix its fragile points, and make a deliberate, documented decision about long-term chain strategy.

**Precondition:** v2.0 Definition of Done is fully checked.

### Step 1 — Document the current design

- Confirm and document in `docs/BLOCKCHAIN.md` that the system performs hash anchoring: on file upload, the backend computes a SHA-256 hash, calls the smart contract's `addRecord(hash)` on Sepolia, and stores the resulting `transactionHash` + `blockNumber` alongside the MySQL row.
- Confirm explicitly: only the hash is ever sent on-chain. Medical data itself is never stored on-chain. Preserve this principle in all future blockchain work.

### Step 2 — Fix the synchronous-wait problem (if not already done in v1.2)

- Confirm the upload endpoint does not block on Sepolia confirmation time. If it still does, apply the async pattern from v1.2 Step 2 now.

### Step 3 — Add retry logic for anchoring failures

- Decouple anchoring failure from upload failure: a record can exist with `transaction_hash = NULL`.
- Add a background job that retries anchoring on RPC failure (rate limit, network blip, gas estimation failure) with exponential backoff, rather than failing the whole upload when only the anchoring step fails.

### Step 4 — Make a deliberate chain-strategy decision

Choose and document one of the following three paths in `docs/BLOCKCHAIN.md`:

- **Path 1 — Stay on testnet, treat blockchain as a demo/PoC feature.** Valid if the blockchain component exists to demonstrate the hash-anchoring pattern rather than provide a production-grade immutability guarantee. If chosen, update any user-facing "blockchain-verified" language so it does not imply permanence while on a testnet that could be deprecated. No code changes required beyond Step 2/3 above.
- **Path 2 — Move to a real, low-cost mainnet-adjacent chain.** Realistic candidates: Polygon PoS mainnet (closest to the existing Web3.js code, near-unchanged ABI integration, gas costs in cents) or an L2 such as Arbitrum/Base. Implementation: update RPC URL and chain ID config, fund a wallet with real-but-small value, combine with the retry/async work above. This is a config change, not an architecture rewrite.
- **Path 3 — Reconsider per-file anchoring granularity (flag for v2.2, do not implement yet).** Document batch anchoring as a future option: collect file hashes over a time window, build a Merkle tree, anchor only the Merkle root on-chain, and store each file's Merkle proof in MySQL. This keeps per-file tamper-evidence while making blockchain cost roughly constant instead of scaling linearly with upload volume. Flag this as v2.2 scope if/when upload volume becomes a real cost concern.

### Step 5 — Harden the blockchain layer regardless of path chosen

- Move the signing private key out of a flat env var into AWS Secrets Manager (consistent with v2.0's secrets approach). Consider AWS KMS or a multi-sig setup if the anchoring wallet ever holds meaningfully more value than gas-money amounts.
- Confirm retry-with-backoff and async confirmation logic (Steps 2–3 above) are fully in place.
- Add monitoring/alerting: trigger an alert if the anchoring wallet's balance drops below a gas-cost threshold (a silently-empty wallet means uploads silently stop getting anchored).
- Finalize `docs/BLOCKCHAIN.md` to explicitly document the deployed contract's address, ABI, and chosen chain — do not leave this implicit in env var comments.

### Definition of Done — v2.1

- [ ] A deliberate decision is made and documented on testnet vs. mainnet vs. L2 (Path 1, 2, or 3) — "undecided" is not an acceptable end state
- [ ] Anchoring is fully asynchronous with retry-with-backoff
- [ ] The signing private key lives in a secrets manager, not a flat `.env`
- [ ] `docs/BLOCKCHAIN.md` documents the contract address, ABI, and chosen chain explicitly
- [ ] Wallet balance monitoring/alerting exists (even a simple cron + email is sufficient)

---

## v2.2 — System Design Upgrades

**Goal:** Scale the architecture — but only the specific pieces where a real symptom justifies the added complexity. This version is a menu, not a fixed checklist; only implement an item once its symptom is actually observed.

| Upgrade | Symptom that signals it's time | What it solves |
|---|---|---|
| Redis cache for `getAvailableSlots()` and doctor search results | Appointment slot queries are a measurable chunk of DB load | Removes redundant DB queries on hot read paths |
| Real job queue (BullMQ + Redis) replacing in-process async for blockchain anchoring | Backend restarts lose in-flight anchoring jobs, or 2+ backend instances cause duplicate anchoring | Durable, retryable background work that survives restarts and scales horizontally |
| Decouple RAG into a real HTTP service (FastAPI) instead of per-query `spawn()` | Chat latency complaints, or RAG needs independent scaling, or connection pooling to MySQL is needed | Removes per-query process startup overhead; allows RAG to scale separately |
| WebSocket / SSE for real-time appointment status | Patients polling for doctor responses; doctors want live booking notifications | Replaces polling with push, improving the confirm/decline UX |
| API Gateway / nginx-level rate limiting and request logging | Multiple backend instances need consistently enforced rate limits | Centralizes cross-cutting concerns instead of duplicating per-service |
| Read replica for MySQL | Read-heavy endpoints contend measurably with writes under load | Standard read/write split once a single RDS instance becomes the bottleneck |
| Batch blockchain anchoring (Merkle tree) | Per-upload anchoring cost or latency becomes a real line item (per v2.1 Path 3) | Decouples anchoring cost from upload volume |

### Implementation steps (apply only to the item(s) whose symptom has appeared)

- **Redis cache:** stand up a Redis instance, cache `getAvailableSlots()` results keyed by doctor+date, invalidate on new bookings/cancellations.
- **Job queue (BullMQ):** stand up Redis, replace the in-process polling job from v1.2 with BullMQ jobs for blockchain anchoring, ensure jobs are idempotent (safe to retry without double-anchoring).
- **RAG as HTTP service:** convert `apps/rag-service` from a subprocess-spawned script into a FastAPI app with its own endpoint; update the backend to call it over HTTP instead of `spawn()`; add a connection pool from the Python service to MySQL.
- **WebSocket/SSE:** add a WebSocket or SSE channel for appointment status updates; update the frontend to subscribe instead of polling.
- **Gateway-level rate limiting:** move rate limiting enforcement to the load balancer/nginx layer in addition to (or instead of) the per-route `express-rate-limit` middleware.
- **Read replica:** provision an RDS read replica; route read-heavy queries (patient history, doctor search) to the replica, keep writes on the primary.
- **Batch anchoring:** implement the Merkle tree batching design from v2.1 Path 3 — collect hashes over a window, anchor only the root, store per-file Merkle proofs in MySQL.

### Reference architecture once v2.2 is fully realized

```
                    ┌─────────────┐
                    │   ALB/nginx │  (rate limit, TLS, routing)
                    └──────┬──────┘
              ┌────────────┼────────────┐
       ┌──────▼─────┐              ┌────▼────────┐
       │  Frontend   │              │  Backend API │ (N instances, stateless, JWT)
       │  (S3+CDN or │              │  (Express)   │
       │   container)│              └──┬───┬───┬──┘
       └─────────────┘                 │   │   │
                          ┌─────────────┘   │   └─────────────┐
                   ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
                   │  RDS MySQL  │   │ Redis (cache │   │  RAG Service │
                   │ (+ replica) │   │ + BullMQ jobs)│   │  (FastAPI,   │
                   └─────────────┘   └──────┬───────┘   │  pooled DB)  │
                                             │           └──────────────┘
                                      ┌──────▼───────┐
                                      │ Worker process│
                                      │ (blockchain    │
                                      │  anchoring,    │
                                      │  email, etc.)  │
                                      └────────────────┘
```

### Definition of Done — v2.2

- [ ] No item from the table above is implemented speculatively — each implemented item has a documented symptom that triggered it
- [ ] Any implemented upgrade is covered by integration tests confirming it doesn't regress existing functionality
- [ ] `docs/ARCHITECTURE.md` is updated to reflect every upgrade actually implemented

---

## v2.3 — Database Modernization (MySQL → MongoDB)

**Goal:** Replace the relational MySQL data layer with MongoDB as the primary operational database while preserving app behavior and making the cutover safe, observable, and reversible until the final switchover.

**Precondition:** v2.2 Definition of Done is fully checked.

### Step 1 — Introduce a MongoDB compatibility layer

- Add a MongoDB client dependency (for example, the official `mongodb` driver) and environment configuration for `MONGO_URI` and `MONGO_DB_NAME`.
- Create a dedicated MongoDB config module (for example, `apps/backend/src/config/mongo.js`) and a repository abstraction so controllers can use either the existing MySQL path or the new MongoDB path behind a feature flag.
- Keep the existing API contract unchanged so the frontend does not need to change during the migration.

### Step 2 — Define the document model

- Map the core business entities into MongoDB collections: `users`, `appointments`, `medical_records`, `prescriptions`, `vital_signs`, `audit_logs`, and `refresh_tokens`.
- Define document shape, validation rules, and indexes for each collection.
- Prefer embedding small, frequently-read context (for example, patient summary data) and referencing larger or less frequently read documents.
- Document the target model in `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.

### Step 3 — Build a migration pipeline

- Create a migration script in `apps/backend/scripts/` or `apps/backend/migrations/` to copy data from MySQL into MongoDB.
- Migrate users, appointments, medical records metadata, prescriptions, vitals, and audit logs in a controlled sequence.
- Preserve stable identifier mapping between legacy MySQL rows and MongoDB documents so audit trails and any temporary dual-write mode remain traceable.
- Add logging and retry behavior for failed rows so the migration can be resumed safely.

### Step 4 — Replace the critical backend flows

- Refactor the auth, booking, record upload, patient history, and admin approval flows to read/write through the MongoDB repository layer.
- Keep the same API endpoints and response shapes so the frontend continues working unchanged.
- Verify that appointment double-booking, access-token validation, and doctor verification flows still behave correctly against MongoDB.

### Step 5 — Cut over and retire MySQL

- Enable MongoDB as the default runtime data source behind the feature flag.
- Run a short dual-read/dual-write or shadow-read period if required for safety.
- Remove MySQL-specific query paths once the MongoDB path is verified in staging or local testing.
- Archive the old SQL schema as historical reference material once the new system is stable.

### Definition of Done — v2.3

- [ ] MongoDB connection config and repository abstraction exist
- [ ] Core collections and indexes are defined for the main business entities
- [ ] A repeatable migration path from MySQL to MongoDB is implemented and tested
- [ ] Auth, booking, record upload, patient history, and admin flows work against MongoDB
- [ ] MySQL is no longer required for primary runtime traffic

---

## v3.0 — Frontend Polish

**Goal:** Iterate on UI/UX safely now that backend security, structure, and testing are in place. This is an ongoing backlog, not a single milestone — there is no strict Definition of Done.

### Step 1 — Consolidate a shared component library

- Now that `components/shared/` exists (from v1.1) and `PatientDashboard.jsx` is split into sections, build a real shared component set: buttons, form inputs, modals, status badges.
- Update doctor, patient, and admin dashboards to use the shared components instead of each reimplementing the same UI patterns.

### Step 2 — Add loading/error states everywhere

- Audit every data-fetching component for the three-state pattern: loading / error / success.
- Add missing error and loading states to any component that currently only handles the happy path.

### Step 3 — Mobile responsiveness pass

- Audit Tailwind breakpoints on the dashboard-heavy pages: appointments, records, chat.
- This is an audit-and-fix pass, not a full redesign, since Tailwind is already in place.

### Step 4 — Standardize on the centralized API client

- Replace every raw `fetch()` call with the centralized `axiosClient.js`.
- This fixes inconsistent auth-header handling and inconsistent 401-logout behavior across the app.

### Step 5 — Accessibility pass

- Add/verify form labels across all forms.
- Add ARIA roles to the chat interface.
- Verify keyboard navigation works through the entire appointment booking flow.

### Step 6 — Document the design system

- Once the above steps are complete, write a short `docs/DESIGN_SYSTEM.md` covering color tokens, spacing scale, and component usage conventions.

### Notes

- v3.0 does not have a strict Definition of Done checklist — treat it as a continuous backlog rather than a milestone to formally close.

---

## Quick-Start: First Five Actions (Do These Immediately)

1. Remove `NODE_TLS_REJECT_UNAUTHORIZED = '0'` and stop logging DB credentials (~30 minutes — closes the worst security holes).
2. Add `express-rate-limit` to `/auth/login` (~30 minutes — closes brute-force risk).
3. Fix `/patient/search` and the `RequireAuth` redirect bugs (~2 hours — makes the app actually work as documented).
4. Mount admin routes with the four functions from v1.0 Step 8 (~half a day — completes a half-built feature).
5. Make the blockchain path decision from v2.1 Step 4 now, even though the code changes come later — this is a decision, not a task, and is cheap now and expensive to leave open.
