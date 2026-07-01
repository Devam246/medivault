# MediVault — Engineering Roadmap & Version Guide

This is the single source of truth for taking MediVault from its current state (working prototype with real security holes) to a deployed, testable, maintainable product. It's organized by **version milestones**, not by team or by file, because most of your problems are coupled — you can't clean the folder structure without first deciding the deployment shape, and you can't deploy safely without first closing the critical security bugs. Each version is a checkpoint you can actually ship and demo.

Read order: skim "Where You Actually Stand" once, then treat each `vX.X` section as a sprint. Don't skip ahead to AWS (v2.0) before finishing v1.0 — half the AWS pain (env vars, TLS, credentials) is actually v1.0 work wearing a deployment costume.

---

## Where You Actually Stand (Baseline Audit)

Pulled from your own docs (`CODE_QUALITY_REPORT.md`, `ARCHITECTURE.md`, `PROJECT_OVERVIEW.md`) — not re-litigating, just consolidating so the plan below has a clear "from":

**Stack**: React 19 + Vite + Tailwind (frontend) · Express 5 + Node (backend) · MySQL 8 (current data layer; v2.3 migrates to MongoDB) · Web3.js → Sepolia testnet (blockchain anchoring) · Python 3.9+ subprocess → Groq LLM (RAG chat).

**Genuinely working**: registration/login, JWT + refresh tokens, medical record upload with blockchain anchoring, appointments, doctor availability, prescriptions, vitals, RAG chat, doctor search/verification filtering.

**Broken or half-built**: admin routes not mounted (frontend exists, backend doesn't), `RequireAuth` redirects to paths that don't exist (`/doctor-dashboard` vs actual `/doctor`), `/patient/search` references `req.app.get('db')` which is never set, `AuthContext.jsx` written but never wired into `main.jsx` (everyone reads localStorage directly instead), two parallel auth implementations (`authController.js` using Argon2 vs `apiAuthController.js` using bcrypt).

**Actively dangerous**: `NODE_TLS_REJECT_UNAUTHORIZED = '0'` disables TLS verification globally for blockchain calls (MITM risk), DB credentials are `console.log`'d on every boot, no rate limiting anywhere (login is brute-forceable), JWT secret/private key/Groq key all sit in a single flat `.env`, no DB transactions around multi-step writes (file upload writes to disk → blockchain → JSON log → MySQL with no rollback if any step fails), TOCTOU race condition lets two patients double-book the same slot.

**Structural debt**: zero tests, `PatientDashboard.jsx` is a 500-line god-component, no DB migrations (schema only exists as inferred SQL in your docs), Python RAG spawns a fresh process per query with no timeout, file storage is local disk only (`/uploads`), package.json is still named `my-react-app`.

This is a normal state for a working prototype built fast. None of it is unusual. The plan below fixes it in the order that minimizes rework.

---

## Versioning Philosophy

Each version has a **theme**, a **definition of done**, and **does not start until the previous version's done-criteria are met**. Versions map roughly to your priority list but reordered for dependency reasons — e.g., folder cleanup is listed as "High Priority" by you but is sequenced *after* the critical security fixes, because renaming/moving files while also patching security-critical code in the same files multiplies merge pain for no benefit. Security first, then structure, then database modernization, then testing, then deployment.

| Version | Theme | Your Objective(s) Covered | Est. Effort |
|---|---|---|---|
| v1.0 | Stop the Bleeding (security + broken routes) | #4 (functionality must work) | 1 week |
| v1.1 | Folder Restructure & Clean Code | #3 | 3-5 days |
| v1.2 | Architecture Hardening (transactions, locking, validation) | #4, #5 | 1 week |
| v2.3 | Database Modernization (MySQL → MongoDB) | #5, #8 | 1-2 weeks |
| v1.3 | Testing Foundation | #6 | 1-1.5 weeks |
| v2.0 | Dockerize + AWS Deployment | #2 | 3-5 days |
| v2.1 | Blockchain Restructure & Advisory | #7 | 3-4 days |
| v2.2 | System Design Upgrades (queues, caching, scaling) | #5 | 1-2 weeks |
| v3.0 | Frontend Polish | #1 | 1-2 weeks |

Total realistic timeline solo: ~7-9 weeks part-time, ~4-5 weeks full-time. This is longer than your own `TODO_RECOMMENDATIONS.md` estimate (55-74 hours) because that document didn't include Docker, AWS, or a real test suite — those are new asks in this guide.

---

## v1.0 — Stop the Bleeding

**Theme**: Nothing gets restructured, dockerized, or tested until these are fixed, because every later version touches these same files. Do this in a single focused pass.

**Why first**: AWS deployment with TLS disabled and credentials in logs means you've just put your security bugs on the public internet with a domain name. Folder restructuring around broken auth logic means you restructure twice. This version is pure damage control plus making the app's existing promises (admin works, search works, redirects work) actually true.

### 1.0.1 — Kill the critical security issues

- **Remove `NODE_TLS_REJECT_UNAUTHORIZED = '0'`** from `blockchain/blockchain.js` entirely. If your Sepolia RPC provider's cert is the issue, fix the actual cert chain — don't disable verification. Test the blockchain call still works against Infura/Alchemy with verification on; it should, this flag was almost certainly cargo-culted from a Stack Overflow answer for an unrelated local-cert issue.
- **Stop logging credentials** in `config/db.js`. Replace `console.log('Database config:', {host, user, password})` with `console.log('DB connected:', host)` — host only, never user/pass.
- **Move secrets out of flat `.env` into tiers**: keep `.env` for non-sensitive config (PORT, NODE_ENV, FRONTEND_URL) but treat `JWT_SECRET`, `PRIVATE_KEY`, `DB_PASS`, `GROQ_API_KEY` as a separate concern from day one — you'll swap this for AWS Secrets Manager in v2.0, so structure your config loader (`config/env.js`, new file) to read from `process.env` but not assume `.env` is the only source. This single abstraction saves you a rewrite later.
- **Standardize password hashing on Argon2.** Delete `apiAuthController.js`'s bcrypt path entirely — don't keep both "just in case." If something still calls the bcrypt-hashed route, migrate those rows (rehash on next successful login is the standard pattern: verify with bcrypt once, immediately rehash with Argon2, update the row).
- **Add rate limiting to `/auth/login` and `/auth/refresh`** using `express-rate-limit` (5 attempts / 15 min per IP, keyed by IP+email if you want to avoid one IP locking out shared-office users). This is a 30-line middleware, do it now — it's the single highest security-value-per-effort item in the whole list.

### 1.0.2 — Fix the routes that lie

- **`/patient/search`**: stop relying on `req.app.get('db')`. Import the pool directly from `config/db.js` in the controller, same pattern every other controller already uses. This is a one-line fix per your own `TODO_RECOMMENDATIONS.md` §1.4 — do it.
- **`RequireAuth.jsx` redirect mismatch**: `navigate('/doctor-dashboard')` → `navigate('/doctor')`, `/admin-dashboard` → `/admin`. Grep the whole frontend for `-dashboard` suffixes used in navigation calls (not route definitions) to make sure you catch every instance, not just the one in `RequireAuth.jsx`.
- **Mount admin routes.** This is bigger than a one-liner — see 1.0.3 below.
- **Wire `AuthContext.jsx` into `main.jsx`.** Either commit to Context as your auth source of truth and remove the localStorage-only reads scattered through components, or delete `AuthContext.jsx` if you've decided localStorage + a couple of helper functions is enough for this app's scale. Don't leave both half-built — pick one. (Recommendation: keep Context, since you're already storing token/role in it and it's the React-idiomatic way to avoid prop drilling once you split `PatientDashboard.jsx` in v1.1.)

### 1.0.3 — Build out Admin (currently frontend-only)

Your `AdminDashboard.jsx` exists with no backend. Minimum viable admin surface for v1.0 (just enough to make the existing frontend functional, not a full feature build):

```
backend/controllers/adminController.js
  - getDoctorList(req, res)         // GET  /admin/doctors?status=pending
  - approveDoctor(req, res)         // POST /admin/doctors/:id/approve
  - rejectDoctor(req, res)          // POST /admin/doctors/:id/reject
  - getSystemStats(req, res)        // GET  /admin/stats (counts: users, records, appointments)

backend/routes/adminRoutes.js
  - wires the above behind requireRole('admin')

backend/server.js
  - app.use('/admin', authenticateToken, adminRoutes)
```

`approveDoctor` sets `is_verified = 1` on the `users` row — this is the one piece of business logic your docs say is "referenced in code but routes missing," so this single feature unblocks your entire doctor-verification story end to end.

### Definition of Done for v1.0

- [ ] No TLS verification disabled anywhere in the codebase
- [ ] No credentials appear in any console.log / log output
- [ ] Single password hashing implementation (Argon2 only)
- [ ] Rate limiting active on login/refresh
- [ ] `/patient/search` returns results instead of erroring
- [ ] Role-based redirects land on real routes, zero redirect loops
- [ ] Admin can approve/reject a doctor end-to-end through the UI
- [ ] `AuthContext` is either fully wired or fully removed — no half-state

Do not proceed to v1.1 until every box above is checked. This is the version where "jldi ho jae" (move fast) is explicitly *not* the goal — this is the one slow, careful pass that makes everything after it safe to move fast on.

---

## v1.1 — Folder Restructure & Clean Code

**Theme**: Your current structure is functional but informal — `apiTestController.js`, `apiAuthRoutes.js`, and `apiTestRoutes.js` are dead/duplicate code sitting next to production code, and the repo root mixes frontend and backend concerns. Restructure now, while v1.0's fixes are fresh and before you add Docker (which cares a lot about where your entrypoints live).

### Target repo layout

```
medivault/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── config/           # db.js, env.js
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── middleware/       # auth.js, rateLimiter.js, errorHandler.js
│   │   │   ├── blockchain/
│   │   │   ├── models/           # NEW — see v1.2, query builders / repositories
│   │   │   ├── utils/
│   │   │   └── server.js
│   │   ├── scripts/               # seedTestDoctor.js, seedDemoData.js, etc.
│   │   ├── migrations/            # NEW — see v1.2, SQL migration files
│   │   ├── tests/                 # NEW — see v1.3
│   │   ├── uploads/                # gitignored, local dev only
│   │   ├── package.json
│   │   └── Dockerfile             # NEW — see v2.0
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── context/
│   │   │   ├── components/
│   │   │   │   ├── auth/
│   │   │   │   ├── layout/
│   │   │   │   ├── patient/
│   │   │   │   ├── doctor/        # NEW — currently doctor components live loose in pages/
│   │   │   │   └── shared/        # NEW — buttons, modals, form inputs reused across roles
│   │   │   ├── pages/
│   │   │   ├── hooks/             # NEW — extract repeated useEffect/useState patterns
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── tests/                 # NEW — see v1.3
│   │   ├── package.json
│   │   └── Dockerfile             # NEW — see v2.0
│   └── rag-service/
│       ├── app.py
│       ├── medical_summary.py
│       ├── requirements.txt
│       └── Dockerfile             # NEW — see v2.0
├── docs/                          # move all your *.md analysis docs here
├── docker-compose.yml             # NEW — see v2.0
├── .github/workflows/             # NEW — see v1.3/v2.0, CI/CD
└── README.md                      # rewritten, see below
```

**Why split into `apps/`**: right now frontend and backend share a repo root, which is fine for `npm run dev` locally but becomes awkward the moment you Dockerize (you don't want backend's `node_modules` build context to include the entire React app) or want independent CI pipelines (no reason to run frontend lint when only `backend/` changed). This is the single highest-leverage structural change for both Docker and CI.

### Code cleanup checklist

- **Delete dead code**: `apiTestController.js`, `apiTestRoutes.js`, `apiAuthRoutes.js`, `apiAuthController.js` (after confirming nothing depends on the bcrypt path post-v1.0 migration). Your own `CODE_QUALITY_REPORT.md` already flagged these — there's no ambiguity here, just delete.
- **Rename `package.json` name field** from `my-react-app` to `medivault-frontend` / `medivault-backend` respectively.
- **Split `PatientDashboard.jsx`** (~500 lines) into the six child components your `TODO_RECOMMENDATIONS.md` §3.3 already scoped: `PatientProfileSection`, `MedicalRecordsSection`, `AppointmentsSection`, `PrescriptionsSection`, `VitalSignsSection`, `HealthChatSection`, with `PatientDashboard.jsx` reduced to a layout/orchestrator that fetches shared data once and passes it down — or better, has each section fetch its own data via a custom hook (`useMedicalRecords()`, `useAppointments()`) so sections are independently testable in v1.3.
- **Centralize canned RAG responses** (currently duplicated in `PatientHealthChat.jsx` and `medical_summary.py`) into a single source — either a shared JSON file both read, or a DB table (`canned_responses`) per your own `TODO_RECOMMENDATIONS.md` §4.2. DB table is better long-term since it lets admin edit responses without a redeploy, but a JSON file checked into `apps/rag-service/` is the 30-minute version if you want it done in v1.1 and upgraded later.
- **Establish a controller pattern and stick to it everywhere**: every controller function should look like `async function name(req, res, next)`, do its DB work, and call `next(err)` on failure rather than ad-hoc `res.status(500).json(...)` scattered with inconsistent shapes. Pair this with a single `errorHandler.js` middleware mounted last in `server.js` that normalizes all error responses to `{success: false, message, code}`. This is mechanical but it's what makes your API predictable for the frontend and for tests.
- **Rewrite `README.md`** — it's currently the generic Vite template. New README should cover: what MediVault is (one paragraph), local dev setup (clone → env → migrate → seed → run), and links to `docs/ARCHITECTURE.md` for anyone wanting depth. Keep it short; depth lives in `docs/`.

### Definition of Done for v1.1

- [ ] Repo split into `apps/backend`, `apps/frontend`, `apps/rag-service`
- [ ] All dead/duplicate controller and route files removed
- [ ] `PatientDashboard.jsx` under 150 lines, split into sections
- [ ] Single error-handling pattern used by every controller
- [ ] README reflects actual project, not Vite boilerplate
- [ ] `npm run dev` still works for both apps after the move (update all relative import paths, this is the easiest step to break silently)

---

## v1.2 — Architecture Hardening

**Theme**: Make the existing features *correct*, not just present. Your `CODE_QUALITY_REPORT.md` already enumerated the exact bugs — this version is executing that list with a couple of additions that matter for AWS readiness later.

### Database: introduce migrations and transactions

You currently have no migration system — schema lives only as inferred SQL in your docs, which means every new environment (including AWS) requires manual table creation. Fix this now, before deployment, not after.

- Add `apps/backend/migrations/` with numbered SQL files (`001_init_schema.sql`, `002_add_indexes.sql`, etc.) — a lightweight tool like `db-migrate` or even a hand-rolled runner that tracks applied migrations in a `schema_migrations` table is enough; you don't need Knex/Prisma-scale tooling for this size of schema, but pick one and commit to it so `docker-compose up` in v2.0 can run migrations automatically on container start.
- **Wrap the file upload pipeline in a real DB transaction.** Currently: disk write → blockchain call → JSON log append → MySQL insert, with no rollback. Minimum fix per your own `TODO_RECOMMENDATIONS.md` §2.4: use `connection.beginTransaction()` / `commit()` / `rollback()` around the MySQL insert, and explicitly clean up the disk file + records.json entry in the catch block if the blockchain call or DB insert fails. The blockchain call itself can't be "rolled back" (it's append-only) — so the safer order is actually: write file to disk → DB insert (in transaction) → on success, kick off blockchain anchoring as a background step that updates the record's `transaction_hash` column once confirmed, rather than blocking the user's upload on Sepolia confirmation time. This also fixes the synchronous-blockchain-timeout risk your `PROJECT_OVERVIEW.md` flagged as a known trade-off.
- **Fix the TOCTOU race in appointment booking** using the unique-constraint approach from `TODO_RECOMMENDATIONS.md` §2.2: `ALTER TABLE appointments ADD UNIQUE(doctor_id, appointment_date, appointment_time)`, then catch `ER_DUP_ENTRY` and return a clean "slot already booked" response. This is strictly better than `SELECT ... FOR UPDATE` for your case because it doesn't hold a row lock across the gap and works correctly even under connection pool pressure.
- **Add the missing indexes** wholesale from `TODO_RECOMMENDATIONS.md` §3.4 — `users.email`, `users.role`, every foreign key column on `appointments`, `medical_records`, `prescriptions`, `vital_signs`, `refresh_tokens`, `patient_access_tokens`. This is a 10-minute migration with outsized payoff once you have real data volume.
- **Optimize refresh token lookup** from O(n) full-table-scan to indexed `WHERE user_id = ?` per `TODO_RECOMMENDATIONS.md` §2.5.
- **Add pagination** to `getPatientHistory` and any other "fetch everything" endpoint, per §3.2.

### Backend: subprocess and request hygiene

- **Add a timeout to the Python RAG subprocess spawn** (`TODO_RECOMMENDATIONS.md` §2.3 has the exact code) — 30s is reasonable for a Groq call plus DB query. Without this, a hung Python process holds an Express request open indefinitely.
- **Input validation layer**: add `zod` or `express-validator` at the route level for every POST/PUT endpoint. Right now validation is inconsistent-to-absent; this is also what makes your eventual test suite meaningful (you're testing real validation logic, not hoping the DB constraint catches it).
- **Centralized audit logging**: add the `access_logs` table from `TODO_RECOMMENDATIONS.md` §4.1 now rather than later — for a *health records* system, "who accessed which patient's data and when" isn't a nice-to-have, it's close to a compliance requirement the moment you have real users. Log at minimum: doctor views patient history (both normal and token-based access), record upload, record delete, prescription creation.

### A note on system design for this version (ties to objective #5)

Two decisions worth making explicitly now rather than drifting into them later:

1. **Repository/data-access layer**: introduce a thin `models/` layer (`models/userRepository.js`, `models/appointmentRepository.js`, etc.) that wraps raw SQL queries. Controllers call `userRepository.findByEmail(email)` instead of writing `db.query('SELECT * FROM users WHERE email = ?', ...)` inline. This isn't over-engineering — it's what makes v1.3 testing tractable (you can mock the repository layer instead of mocking MySQL) and it's a 1-day mechanical refactor at this codebase size, not a rewrite.
2. **Async blockchain anchoring (mentioned above)**: this is your first real architectural fork — decide now whether background jobs are a setTimeout-based in-process queue (fine for current scale) or a real job queue (BullMQ + Redis — see v2.2). For v1.2, in-process polling is enough; don't add Redis yet, that's v2.2's job once you actually need horizontal scaling.

### Definition of Done for v1.2

- [ ] Migrations exist and a fresh database can be built from them alone (no manual SQL)
- [ ] File upload is transactional; a failed blockchain anchor doesn't leave an orphaned DB row or orphaned file
- [ ] Appointment double-booking is impossible (verified by attempting it twice in parallel)
- [ ] All FK columns indexed
- [ ] Refresh token lookup is O(1) via indexed query
- [ ] Python subprocess has a hard timeout
- [ ] Every POST/PUT route validates its input
- [ ] `access_logs` table exists and is written to on every sensitive read/write
- [ ] At least `userRepository` and `appointmentRepository` exist and are used by their respective controllers

---

## v1.3 — Testing Foundation

**Theme**: Currently 0% coverage. You don't need 100%, you need *enough that a regression in auth, booking, or file upload is caught before a human finds it*. This version builds the pyramid bottom-up: unit → integration → E2E, and wires it into CI so it runs automatically.

### Layer 1 — Unit tests (Jest, backend)

Target the repository layer and pure logic functions first — these are cheap to test because v1.2 already isolated them.

```
apps/backend/tests/unit/
  ├── repositories/
  │   ├── userRepository.test.js
  │   └── appointmentRepository.test.js
  ├── utils/
  │   ├── generateTimeSlots.test.js       # pure function, easy win
  │   └── normalizeQuery.test.js          # canned-response matching
  └── middleware/
      └── auth.test.js                    # JWT verify/reject logic
```

Use `jest` + `mysql2` mocking (or a real ephemeral test DB via Docker — see below, this is actually preferable for repository tests since SQL syntax errors don't get caught by mocks).

### Layer 2 — Integration tests (Jest + Supertest, backend)

These hit real routes against a real (test) database, asserting full request → response behavior including auth middleware and validation.

```
apps/backend/tests/integration/
  ├── auth.test.js          # register, login, refresh, rate-limit triggers after 5 attempts
  ├── appointments.test.js  # book, double-book rejection, cancel, slot generation
  ├── fileUpload.test.js    # upload succeeds, DB row matches blockchain tx, rollback on failure
  └── admin.test.js         # approve doctor flow end-to-end
```

**Critical setup**: spin up a disposable MySQL instance for tests (Docker makes this trivial — `docker run mysql:8 --name medivault-test-db` in your CI step, migrations run against it, tests run, container destroyed). Never run integration tests against your dev or prod database.

For the blockchain and Groq calls specifically: **mock them in integration tests**. You don't want CI depending on Sepolia testnet uptime or burning Groq API quota on every push. Use `jest.mock()` for `blockchain.js` and stub the Python subprocess call (or better, since you've isolated it, mock at the `child_process.spawn` boundary) to return canned responses. Real blockchain/Groq calls belong in a separate, manually-triggered "smoke test" suite, not your main CI gate.

### Layer 3 — Frontend component tests (React Testing Library)

```
apps/frontend/tests/
  ├── components/
  │   ├── RequireAuth.test.jsx       # redirects correctly for each role (regression guard for the v1.0 bug)
  │   └── PatientHealthChat.test.jsx # canned response matches, loading state, error state
  └── pages/
      └── Login.test.jsx             # form validation, submit calls correct endpoint
```

### Layer 4 — E2E tests (Cypress, since you named it specifically)

This is what proves the *whole stack* works together — frontend, backend, DB, all running. Cypress is the right pick over raw Selenium WebDriver here because it has first-class support for the exact stack you're on (Vite dev server, network stubbing for the slower blockchain/Groq calls, time-travel debugging), and it's significantly less infrastructure to maintain than Selenium Grid for a project this size. If a future requirement needs cross-browser (Safari/Firefox) coverage that Cypress doesn't natively cover, that's when Playwright or Selenium earns its place — don't reach for it preemptively.

```
apps/frontend/cypress/e2e/
  ├── auth-flow.cy.js
  │     - register as patient → login → land on /patient-dashboard
  │     - register as doctor → login → land on /doctor (regression guard for redirect bug)
  │     - wrong role attempts /admin → redirected, not crashed
  ├── appointment-flow.cy.js
  │     - patient books slot → doctor sees it in dashboard → doctor confirms → patient sees status change
  │     - two browser sessions attempt same slot → one gets clean rejection
  ├── record-upload-flow.cy.js
  │     - patient uploads file → record appears in list → blockchain tx hash present
  ├── easy-access-flow.cy.js
  │     - patient generates token → doctor redeems it → sees patient history → token expires after window
  └── admin-approval-flow.cy.js
        - admin sees pending doctor → approves → doctor now appears in patient search
```

Run Cypress against a docker-compose'd full stack (this is a strong argument for doing v2.0's Docker work *before* writing too many E2E tests — `docker-compose up` becomes your one-command "spin up everything Cypress needs" step). If you want Docker ready before tests, you can reorder v1.3 and v2.0, but the security/structure work in v1.0-v1.2 should still come first regardless.

### CI wiring

```
.github/workflows/test.yml
  - on: pull_request, push to main
  - jobs:
      backend-unit:      npm test (unit only, fast, every push)
      backend-integration: spin up MySQL service container, run migrations, npm run test:integration
      frontend-unit:      npm test (RTL)
      e2e:                docker-compose up, wait for healthy, npx cypress run (can be slower/nightly if CI minutes are a concern)
```

### Definition of Done for v1.3

- [ ] Backend unit test coverage on repositories and utils ≥ 60% (matches your own `CODE_QUALITY_REPORT.md` target)
- [ ] Integration tests cover auth, appointments, file upload, admin approval
- [ ] At least the `RequireAuth` redirect bug has a permanent regression test (it broke once, it's the kind of thing that breaks again)
- [ ] One Cypress E2E spec per core user journey (auth, booking, upload, easy access, admin)
- [ ] CI runs all of the above on every PR; broken tests block merge

---

## v2.0 — Dockerize + AWS Deployment

**Theme**: You said "maybe just backend also works but jo jldi ho jae" — the fastest *defensible* path is containerize everything (it's not extra work, it's what makes deployment reproducible at all) and deploy with the smallest AWS surface that's still production-real, not a toy. Below is the fast path and the "more correct later" path, clearly separated so you can ship the fast one without painting yourself into a corner.

### Step 1 — Dockerfiles (do this regardless of fast/correct path)

**`apps/backend/Dockerfile`**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 4000
CMD ["node", "src/server.js"]
```

**`apps/rag-service/Dockerfile`**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
```
Note: since your current architecture has Node `spawn()` a Python script rather than calling it over HTTP, containerizing them *separately* only makes sense if you also change the IPC mechanism (see "Decouple RAG into its own service" below). If you're keeping the spawn-based approach for the fast path, bundle Python directly into the backend image instead (multi-stage Dockerfile installing both Node and Python) — simpler, ships faster, revisit the split in v2.2.

**`apps/frontend/Dockerfile`** (multi-stage: build static assets, serve via nginx)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

**`docker-compose.yml`** (root) — for local dev parity and as the AWS deployment unit if you go the ECS/EC2 route:
```yaml
services:
  mysql:
    image: mysql:8
    environment:
      MYSQL_DATABASE: medivault_db
      MYSQL_ROOT_PASSWORD: ${DB_PASS}
    volumes: ["mysql-data:/var/lib/mysql"]
  backend:
    build: ./apps/backend
    env_file: ./apps/backend/.env
    depends_on: [mysql]
    ports: ["4000:4000"]
  frontend:
    build: ./apps/frontend
    ports: ["80:80"]
    depends_on: [backend]
volumes:
  mysql-data:
```

### Step 2 — Choose your AWS shape

Two real options, both legitimate, pick based on how much "jldi" you actually need:

**Option A — Fastest to ship (recommended for "jo jldi ho jae"): Single EC2 + Docker Compose + RDS**
1. Provision one EC2 instance (t3.small is plenty to start), install Docker + Docker Compose.
2. Provision **RDS MySQL** (don't run MySQL in a container in production — managed DB is both safer and barely more setup than self-hosting). Free tier covers a `db.t3.micro` for a year.
3. Point `docker-compose.yml`'s DB env vars at the RDS endpoint, drop the local `mysql` service from the compose file for prod.
4. `git pull` + `docker-compose up -d --build` on the box is your entire deploy process for v2.0. Genuinely "jldi."
5. Put an Elastic IP on the instance, point your domain's A record at it, terminate TLS with **Caddy or nginx + Let's Encrypt** running as another container in the compose file (Caddy is less config for this — auto-HTTPS in about 5 lines).
6. Store secrets (`JWT_SECRET`, `PRIVATE_KEY`, `DB_PASS`, `GROQ_API_KEY`) in **AWS Secrets Manager** or even just SSM Parameter Store (cheaper, fine for this scale), injected into the EC2 instance's environment at boot via a small startup script rather than committed to a `.env` file on disk. This is the one place not to cut corners even on the fast path — it's a 30-minute setup difference between "secrets in plaintext on a box" and "secrets properly managed."

This gets you a real, working, reasonably secure production deployment in under a day once v1.0-v1.3 are done. It will not auto-scale and a box reboot means brief downtime, both of which are fine for a project at this stage.

**Option B — More correct, more setup: ECS Fargate + RDS + S3 + ALB**
- Push images to **ECR**, run them as **ECS Fargate** tasks (no EC2 management, scales by task count).
- **Application Load Balancer** in front, handles TLS termination via **ACM** certificate (free, auto-renewing).
- **RDS MySQL** same as Option A.
- **S3** for the `/uploads` directory instead of container-local disk — this is not optional in Fargate (containers are ephemeral, local disk doesn't persist across deploys), so this forces a code change: swap `multer`'s disk storage engine for `multer-s3`. This is a clean, contained change — one file (`fileRoutes.js`'s multer config) — and arguably something you want even on Option A eventually, since EC2 local disk also doesn't survive an instance replacement.
- CI/CD via GitHub Actions: on merge to `main`, build images, push to ECR, force new ECS deployment.

**Recommendation**: ship Option A now to get something real deployed fast, but make the **S3-instead-of-local-disk** change regardless of which option you pick — it's small, it's correct either way, and it's the one piece of Option B worth doing even on Option A's timeline (an EC2 instance you replace or resize will otherwise silently lose every uploaded medical record). Migrate from A to B later only if you actually hit a scaling wall; don't pre-build for load you don't have yet.

### Step 3 — Backend-only fast path (if frontend deploy genuinely doesn't matter yet)

If "maybe just backend also works" means you want the API live first and frontend later: deploy steps 1-2 for `backend` + `mysql` only, run the frontend locally pointed at the deployed API URL (update `VITE_API_URL` env var, currently hardcoded to `localhost:4000` in `axiosClient.js` — fix that hardcoding regardless, it should always read from an env var so this kind of split deploy is trivial). This is a legitimate intermediate step, not a hack.

### Definition of Done for v2.0

- [ ] All three services (backend, frontend, rag) have working Dockerfiles
- [ ] `docker-compose up` reproduces the full stack locally identically to how it will run in prod
- [ ] Secrets are not committed to git and not stored in plaintext on the deployed instance
- [ ] Database is RDS, not a container (even on the fast path)
- [ ] File uploads survive a server restart (S3 or persistent EBS volume, not ephemeral container disk)
- [ ] HTTPS is enforced (no plain HTTP in production)
- [ ] `VITE_API_URL` and equivalent backend `FRONTEND_URL` are env-driven, not hardcoded

---

## v2.1 — Blockchain Restructure & Advisory

**Theme**: This is the section you asked to be specifically an "advisory document" — so it's written slightly differently: less "do this" checklist, more "here's the honest tradeoff space, here's what your current implementation is doing right and wrong, here's what to actually do."

### What your current implementation does

Per `ARCHITECTURE.md`: on every file upload, the backend computes a SHA-256 hash of the file, then synchronously calls a smart contract's `addRecord(hash)` method on Sepolia testnet, waits for the transaction receipt, and stores the resulting `transactionHash` + `blockNumber` alongside the MySQL row. This is a legitimate, common pattern called **hash anchoring** — you are not storing medical data on-chain (good — you never should, it's public and immutable, the opposite of what health data needs), you're storing a cryptographic fingerprint that lets anyone later prove "this exact file existed, unmodified, at this point in time."

### What's actually right about this design

Hash anchoring instead of on-chain storage is the correct call — full stop. A lot of "blockchain for healthcare" projects get this wrong by trying to put PHI on-chain. You didn't make that mistake. Keep this principle as you build forward: **the chain only ever sees a hash, never the data**.

### What's wrong or fragile about the current implementation

1. **Synchronous wait blocks the user-facing request.** Sepolia confirmation can take anywhere from a few seconds to a couple minutes under congestion. Your upload endpoint is, today, only as fast as the slowest possible Sepolia block time. This is the #1 fix — already called out in v1.2 above (move anchoring to background, confirm the file/DB write immediately, update the record once the chain confirms).
2. **No retry logic.** If the RPC call fails (rate limit, network blip, gas estimation failure), the upload fails entirely, even though the file and hash are both fine — only the *anchoring* failed. Decouple these: a file can exist with `transaction_hash = NULL` and a background job that retries anchoring, rather than treating an RPC hiccup as an upload failure.
3. **Private key lives in plaintext env var, signs from a single hot wallet, no separation of duties.** For a testnet demo this is acceptable. For anything closer to production, this is the part of the system most worth treating with real caution — see below.
4. **Testnet (Sepolia) is fine for now but has an expiry problem you may not have priced in**: testnets get reset/deprecated periodically (this has happened to Ropsten, Rinkeby, Kovan — all now defunct), and your "permanent, immutable" audit trail is sitting on infrastructure with no permanence guarantee. This needs an explicit decision, not a default.

### The advisory: three honest paths forward, pick one deliberately

**Path 1 — Stay on testnet, treat blockchain as a demo/PoC feature, not a compliance claim.** This is completely valid if MediVault's blockchain piece exists to demonstrate the *pattern* (hash anchoring for tamper-evidence) rather than to make a real immutability guarantee today. If you pick this path: say so explicitly in your docs/marketing — "blockchain-verified" claims should not imply production-grade permanence while you're on a testnet that could be deprecated. No code changes required beyond the async fix in v1.2, just honest framing.

**Path 2 — Move to a real, low-cost mainnet-adjacent chain when you're ready for real users.** You don't need Ethereum mainnet (gas costs would be brutal for a "hash anchor on every upload" pattern at scale). Realistic candidates, roughly in order of "closest to your existing Web3.js code with minimal rewrite": Polygon PoS mainnet (EVM-compatible, your existing Web3.js + ABI code works almost unchanged, gas costs are cents not dollars), or an L2 like Arbitrum/Base. This is a config change (RPC URL, chain ID, a funded wallet with real-but-small value) plus the retry/async work from v1.2 — not an architecture rewrite, because you built on Web3.js + a generic ABI interface rather than chain-specific tooling. That was a good decision early on; it pays off here.

**Path 3 — Reconsider whether per-file blockchain anchoring is the right granularity at all.** Worth at least considering before scaling this further: anchoring *every single file upload* as its own transaction means cost and latency scale linearly with upload volume. A common pattern at higher scale is **batch anchoring** — collect hashes over a window (e.g., hourly or daily), build a Merkle tree of all hashes in that window, anchor only the Merkle root on-chain, and store the Merkle proof per-file in MySQL. This gives every individual file the same tamper-evidence guarantee (you can still prove any single file was included) while making blockchain cost roughly constant regardless of upload volume instead of growing with it. This is a real architectural change, not a v2.1-sized task — flag it as a candidate for v2.2 system design work if/when upload volume becomes a real cost concern, not before.

### Security hardening specific to the blockchain layer (do regardless of path chosen)

- Move the signing private key out of a flat env var into **AWS Secrets Manager** (consistent with the v2.0 secrets approach) at minimum; consider a proper key management service (AWS KMS) or a multi-sig setup if the anchoring wallet ever holds meaningfully more value than gas-money amounts.
- Add the retry-with-backoff + async confirmation logic (v1.2 scope).
- Add basic monitoring: alert if the anchoring wallet's balance drops below a gas-cost threshold (a silently-empty wallet means uploads silently stop getting anchored — this has bitten real projects).
- Document the contract's actual deployed ABI and address in `docs/BLOCKCHAIN.md` (currently this lives only in env var assumptions per `CONFIGURATION.md` — make it explicit, versioned documentation, since "what does our contract actually do" should not require reading env var comments to answer).

### Definition of Done for v2.1

- [ ] A deliberate decision is made and documented on testnet-vs-mainnet-vs-L2 (Path 1/2/3 above) — "we haven't thought about it" is the only wrong answer here
- [ ] Anchoring is async with retry-with-backoff (if not already done in v1.2)
- [ ] Private key is in a secrets manager, not a flat `.env`
- [ ] `docs/BLOCKCHAIN.md` documents the contract address, ABI, and the chosen chain explicitly
- [ ] Wallet balance monitoring/alerting exists (even a simple cron + email is enough at this stage)

---

## v2.2 — System Design Upgrades

**Theme**: Everything up to here makes the current architecture correct and deployed. This version is for when you actually have load or feature pressure that justifies more moving parts — not before. Each item below names the specific symptom that would tell you it's time.

| Upgrade | Symptom that tells you it's time | What it solves |
|---|---|---|
| **Redis cache** for `getAvailableSlots()` and doctor search results | Appointment slot queries showing up as a measurable chunk of DB load; this is a deterministic computation re-run on every request for no reason | Cuts redundant DB queries to near-zero for hot read paths |
| **Real job queue (BullMQ + Redis)** replacing in-process async for blockchain anchoring | You restart the backend and in-flight anchoring jobs vanish; or you scale to 2+ backend instances and need anchoring jobs to not duplicate across them | Durable, retryable background work that survives restarts and scales horizontally |
| **Decouple RAG into a real HTTP service (FastAPI)** instead of `spawn()`-per-query | Chat response latency complaints, or you want to scale RAG independently of the main API, or you want connection pooling to MySQL from Python instead of opening a fresh connection every subprocess | Removes per-query process startup overhead (your own `CODE_QUALITY_REPORT.md` already flags this as a known cost); makes RAG horizontally scalable separately from the Node API |
| **WebSocket / SSE for real-time appointment status** | Patients polling the dashboard to see if a doctor responded; doctors wanting live notification of new bookings | Replaces polling with push, meaningfully better UX for the appointment confirm/decline loop |
| **API Gateway (or just nginx/ALB-level) rate limiting and request logging** beyond the per-route `express-rate-limit` from v1.0 | You have multiple backend instances and need rate limits enforced consistently across all of them, not per-instance | Centralizes cross-cutting concerns instead of duplicating in every service |
| **Read replica for MySQL** | Read-heavy endpoints (patient history, doctor search) measurably contending with writes (appointments, uploads) under load | Standard read/write split once a single RDS instance becomes the bottleneck |
| **Batch blockchain anchoring (Merkle tree)** | Per-upload anchoring cost or latency becomes a real line item, per the v2.1 advisory | Decouples anchoring cost from upload volume |

None of these are "do this next" — they're a menu you reach for when the specific symptom shows up. Building any of them speculatively before the symptom exists is the classic premature-scaling trap; your current architecture (monolithic Express API, synchronous-but-now-async-background blockchain, MySQL single instance) comfortably handles real early-stage traffic. Revisit this table when you have actual usage numbers, not before.

### A light architecture diagram for what v2.2 looks like fully realized

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

This is the natural evolution of your current architecture, not a rewrite — every box above already has a clear ancestor in your current system per `ARCHITECTURE.md`. That's a good sign; it means the v1.x hardening work wasn't wasted effort, it's the foundation this scales from.

---

## v3.0 — Frontend Polish

**Theme**: Explicitly your lowest priority, sequenced last on purpose. Once the backend is secure, structured, tested, and deployed, frontend work is low-risk to iterate on — you can ship UI changes without touching anything that could compromise data integrity or auth.

- **Component library consolidation**: now that v1.1 split `PatientDashboard.jsx` into sections and v1.1 introduced `components/shared/`, build out a real shared component set (buttons, form inputs, modals, status badges) so doctor/patient/admin dashboards stop reimplementing the same UI patterns three times.
- **Loading/error states everywhere**: audit every data-fetching component for the three-state pattern (loading / error / success) — right now several components likely only handle the happy path.
- **Mobile responsiveness pass**: Tailwind is already in place, so this is largely about auditing breakpoints on the dashboard-heavy pages (appointments, records, chat) rather than a redesign.
- **Replace raw `fetch()` calls with the centralized `axiosClient.js`** everywhere — per `DEPENDENCY_GRAPH.md`, some components already use the configured client and others use raw `fetch`, which means inconsistent auth-header handling and inconsistent 401 logout behavior across the app.
- **Accessibility pass**: form labels, ARIA roles on the chat interface, keyboard navigation for the appointment booking flow — health software has a higher-than-average chance of being used by people who need this.
- **Design system documentation**: once the above is done, a short `docs/DESIGN_SYSTEM.md` documenting your color tokens, spacing scale, and component usage saves future-you from drift.

This version doesn't get a strict Definition of Done checklist the way earlier versions do — it's genuinely iterative and lower-stakes, so treat it as an ongoing backlog rather than a single milestone to close.

---

## Summary: What to Actually Do This Week

If you read nothing else, do these five things first, in this order:

1. Remove `NODE_TLS_REJECT_UNAUTHORIZED = '0'` and stop logging DB credentials (30 minutes, closes your worst security holes).
2. Add `express-rate-limit` to `/auth/login` (30 minutes, closes brute-force risk).
3. Fix the `/patient/search` and `RequireAuth` redirect bugs (2 hours, makes the app actually work as documented).
4. Mount admin routes with the four functions listed in v1.0.3 (half a day, completes a feature that's currently half-built).
5. Pick your blockchain path from v2.1's advisory section *now*, even though the code changes come later — this is a decision, not a task, and it's cheap to make early and expensive to leave ambiguous.

Everything else in this document is real and worth doing, but those five are the difference between "prototype with known issues" and "prototype with a plan."
