# MediVault — Project Context

This document summarizes the **MediVault** codebase for presentations and written reports: product intent, architecture, main flows, technology choices, configuration, and notable implementation gaps.

---

## 1. Product summary

**MediVault** is marketed on the landing page as a **secure digital health record system**: centralized medical history, appointments, prescriptions, and optional AI-assisted understanding of patient data. The stack combines a **React (Vite) frontend**, an **Express 5 API** backed by **MySQL**, **file uploads** with **SHA-256 hashing** and **Ethereum (Sepolia) smart contract** anchoring, and a **Python** service using **Groq** for summarization and **RAG-style** Q&A over patient records.

---

## 2. Repository layout

| Area | Path | Role |
|------|------|------|
| Frontend | `src/` | React 19 SPA, Tailwind 4, React Router 7 |
| HTTP API | `backend/server.js`, `backend/routes/`, `backend/controllers/` | REST API, auth, CRUD, uploads |
| Database access | `backend/config/db.js` | `mysql2` connection pool |
| Blockchain | `backend/blockchain/blockchain.js` | Web3.js → Sepolia contract `addRecord(hash)` |
| AI / RAG | `backend/python/app.py`, `backend/python/medical_summary.py` | Groq chat API, MySQL-backed retrieval |
| Local chain log | `backend/records.json` | Append-only JSON mirror of upload metadata (ids, hashes, tx ids) |
| Uploaded files | `backend/uploads/` (created at runtime) | Static served at `/uploads` |
| Tooling | `package.json`, `vite.config.js` | Scripts: `dev`, `build`, `seed:test-doctor` |

Root `package.json` still uses the npm name `my-react-app`; the user-facing product name is **MediVault**.

---

## 3. Technology stack

### Frontend

- **React 19**, **Vite 7**, **React Router 7**
- **Tailwind CSS 4** via `@tailwindcss/vite`
- **axios** (`src/api/axiosClient.js`) and **fetch** (e.g. patient dashboard) both call `http://localhost:4000`
- **lucide-react** for icons
- **dayjs** (dependency; used where dates are formatted in UI)

### Backend (Node)

- **Express 5**, **CORS** (origin `http://localhost:5173`, credentials)
- **mysql2/promise** pool
- **jsonwebtoken** (access JWT, short expiry) + **argon2** for password and refresh-token hashing
- **multer** for multipart uploads
- **web3** (v4) for Sepolia transactions
- **cookie-parser** (mounted; primary auth in practice is Bearer JWT from localStorage on many routes)

### Backend (Python)

- **mysql-connector-python** (via `medical_summary.py`) for reads/writes including optional `patient_summaries` table
- **Groq** OpenAI-compatible HTTP API (`GROQ_CHAT_URL`), default model `llama-3.3-70b-versatile` (overridable with `GROQ_MODEL`)
- CLI entry: `app.py` supports `--patient_id`, optional `--query` + `--top_k` for RAG, or summary mode without `--query`

---

## 4. Runtime ports and CORS

- **Frontend (Vite):** `http://localhost:5173` (default)
- **Backend (Express):** port **4000** (`app.listen(4000)`)
- CORS is locked to the Vite origin; JSON body limit **10 MB**.

---

## 5. User roles and routing (frontend)

Routes are defined in `src/App.jsx`:

| Path | Protection | Purpose |
|------|------------|---------|
| `/` | Public | Landing / marketing |
| `/login`, `/register` | Public | Auth |
| `/patient-dashboard` | `RequireAuth` role `patient` | Patient hub (records, appointments, vitals, AI chat, upload) |
| `/doctor` | `RequireAuth` role `doctor` | Doctor dashboard |
| `/doctor/patient/:id` | Doctor | Patient history |
| `/doctor/schedule` | **Not** wrapped in `RequireAuth` in `App.jsx` | Schedule management (may rely on page-level checks) |
| `/patient/book-appointment` | **Not** wrapped in `RequireAuth` | Booking flow |
| `/admin` | `RequireAuth` role `admin` | Admin UI (see gaps below) |
| `*` | — | Redirect to `/` |

`src/context/AuthContext.jsx` exists (JWT payload decode, `accessToken` / `refreshToken` keys) but **`main.jsx` does not wrap the app in `AuthProvider`**, so most flows rely on **`localStorage`** (`mv_token`, `mv_role`) from `Login.jsx`, not the context.

---

## 6. Authentication model (backend)

- **Register patient:** `POST /auth/register` — Argon2 password hash; `role = patient`, `is_verified = 1`
- **Register doctor:** `POST /auth/register-doctor` (multipart) — stores credentials and document path; **`is_verified = 0`** until an admin approves (intended workflow)
- **Login:** `POST /auth/login` — body: `email`, `password`, **`role`** (must match DB row). Returns `{ token, refreshToken, role }`. Access token payload: `{ id, role }`, signed with `JWT_SECRET`, **15m** expiry
- **Refresh:** `POST /auth/refresh` — validates refresh token against `refresh_tokens` table (Argon2 hashes)
- **Middleware:** `authenticateToken` reads `Authorization: Bearer <jwt>`; `requireRole('patient'|'doctor')` enforces role

Duplicate-style API under **`/api/auth`** (`apiAuthController`) exists for alternate register/login clients.

---

## 7. Major API surface (Express)

Prefix as mounted in `backend/server.js`:

| Mount | Examples |
|-------|----------|
| `/auth` | register, register-doctor, login, refresh |
| `/patient` | profile, medical-records, appointments, prescriptions, vital-signs, dashboard, **`POST /patient/rag/chat`** |
| `/doctor` | dashboard, search, patient history, prescriptions, availability |
| `/appointments` | patient/doctor booking, slots, cancel, respond, availability CRUD, token-based history |
| `/doctors` | **`GET /doctors/search`** — verified doctors search (used by booking UI) |
| `/files` | **`POST /files/upload`** (patient/doctor medical file pipeline), `GET /files/records` |
| `/api/auth`, `/api` | Secondary auth and test routes |

**Medical file upload pipeline** (`fileRoutes.js`): authenticate → multer save under `uploads/` → SHA-256 hash → **`addRecordToBlockchain(fileHash)`** → append **`records.json`** → insert **`medical_records`** in MySQL (patient self-upload vs doctor upload with `patient_id` in body). Allowed extensions: pdf, jpg/png, doc/docx, xlsx (see route file filter).

**Blockchain:** `blockchain.js` expects `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `CONTRACT_ADDRESS`, and ABI via `CONTRACT_ABI_JSON` or `CONTRACT_ABI_PATH`. Contract is assumed to expose `addRecord(bytes32/string hash)` and `count()`.

**RAG chat:** Node `ragController.js` spawns `python app.py --patient_id … --query … --top_k …` with `GROQ_API_KEY` and DB password passed into the child environment.

---

## 8. Data model (inferred from code)

No single SQL migration file ships in-repo; behavior implies tables including:

- **`users`** — id, name, email, password_hash, role, is_verified, patient fields (dob, blood_group, phone, address, emergency_contact), doctor fields (reg_number, degree, document_path), etc.
- **`doctor_profiles`** — user_id, specialty, qualification, experience, location, fees, availability columns, bio, etc.
- **`medical_records`** — patient_id, doctor_id (optional), title, type, record_date, file_path, notes, uploaded_by
- **`appointments`** — patient_id, doctor_id, date/time, reason, status, token fields where used
- **`refresh_tokens`** — user_id, token_hash
- **`patient_summaries`** — created on demand by Python (`ensure_summaries_table`) for cached AI summaries

---

## 9. Environment variables (names only)

**MySQL (Node + Python):** `DB_HOST`, `DB_USER`, `DB_PASS` (Node); Python also accepts `DB_PASSWORD`, `DB_NAME`, `DB_PORT`

**JWT:** `JWT_SECRET`

**Blockchain:** `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `CONTRACT_ADDRESS`, `CONTRACT_ABI_JSON` or `CONTRACT_ABI_PATH`

**AI:** `GROQ_API_KEY`, optional `GROQ_MODEL`, optional `PYTHON_PATH` (for spawn)

**Python:** may load `backend/.env` and optional `backend/utils/.env`

Do **not** commit real secrets; rotate any key that was ever committed to git.

---

## 10. Security and operations notes (for an honest report)

- **`process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"`** in `server.js` and similar HTTPS agent settings in blockchain code weaken TLS verification — acceptable only for tightly controlled local/dev setups, not production as-is.
- **`db.js` logs database host/user/password/db name to console** — risky for production logs.
- **Refresh token lookup** iterates all rows in `refresh_tokens` to Argon2-verify — fine for demos, poor scalability.
- **Admin approval:** business logic references admin verification for doctors, but **no `/admin/...` routes are registered in `server.js`**, while `AdminDashboard.jsx` calls `/admin/doctors/pending` and approve/reject — the admin feature is **not wired end-to-end** in the current server file.
- **`RequireAuth.jsx`** redirects wrong-role users to **`/doctor-dashboard`** and **`/admin-dashboard`**, but `App.jsx` uses **`/doctor`** and **`/admin`** — role-mismatch redirects can loop or 404.
- **`/patient/search`** in `patientRoutes.js` uses `req.app.get('db')`, which is **not set** in `server.js` — that handler likely errors; doctor search should use **`GET /doctors/search`** (which imports `db` correctly).
- **Token key inconsistency:** Login stores `mv_token`; `axiosClient` reads `mv_token` (aligned); `AuthContext` uses `accessToken` / `refreshToken` keys — unused unless components are migrated to context.
- **Package metadata:** root name/version in `package.json` do not reflect “MediVault” branding.

---

## 11. How to run (typical local demo)

1. **MySQL:** create database and tables consistent with controllers (or import your schema if you maintain one separately).
2. **Backend:** `cd` to repo root, configure `backend/.env`, run the server entry you use in development (the repo’s `server.js` is the main Express app; ensure `node backend/server.js` or your documented command — align with your `package.json` scripts if you add one).
3. **Frontend:** `npm run dev` → Vite on 5173.
4. **Python:** install dependencies for `backend/python` (Groq + mysql connector as used in `medical_summary.py`), ensure `python` is on PATH or set `PYTHON_PATH`.
5. **Blockchain:** configure Sepolia RPC and funded wallet; deploy contract matching ABI.

Script **`npm run seed:test-doctor`** runs `backend/scripts/seedTestDoctor.js` for test data (adjust to your DB policies).

---

## 12. Suggested presentation storyline

1. **Problem:** fragmented health records and trust in document integrity.
2. **Solution:** MediVault — role-based portal, MySQL as system of record, files on disk, **hash anchored on-chain** for tamper-evidence narrative.
3. **Differentiators:** doctor verification concept, appointments with slot logic, **Groq-powered** patient Q&A / summaries over their own data (RAG).
4. **Architecture diagram (mental):** Browser → Express → MySQL / filesystem / optional Web3; Express → spawn Python → Groq + MySQL.
5. **Honest next steps:** mount admin routes (or change frontend to existing APIs), fix `RequireAuth` paths, fix `/patient/search` db access, harden TLS and logging, unify auth storage/context, add SQL migrations to the repo.

---

## 13. File index (high signal)

| File | Why it matters |
|------|----------------|
| `src/App.jsx` | All top-level routes |
| `src/pages/Landing.jsx` | Product positioning copy |
| `src/pages/patient/PatientDashboard.jsx` | Main patient UX + API usage |
| `src/components/patient/PatientHealthChat.jsx` | RAG chat UI |
| `backend/server.js` | App assembly, CORS, static uploads |
| `backend/routes/fileRoutes.js` | Upload + hash + chain + DB |
| `backend/blockchain/blockchain.js` | Sepolia Web3 integration |
| `backend/controllers/ragController.js` | Node ↔ Python bridge |
| `backend/python/medical_summary.py` | Groq + DB retrieval/summaries |
| `backend/middleware/auth.js` | JWT + role gate |

---

*Generated from repository analysis for reporting and slides. Update this file when architecture or env requirements change.*
