# MediVault Architecture

MediVault is a monorepo with three runtime apps:

| App | Path | Role |
|---|---|---|
| Backend API | `apps/backend/` | Express 5, JWT auth, MySQL, file uploads, blockchain anchoring |
| Frontend | `apps/frontend/` | React 19 + Vite patient/doctor/admin portals |
| RAG service | `apps/rag-service/` | Python subprocess for Groq-powered health chat |

## Request flow

1. React UI calls `http://localhost:4000` (see `apps/frontend/src/api/`).
2. Express routes authenticate via JWT middleware, then delegate to controllers.
3. Controllers query MySQL through `apps/backend/src/config/db.js`.
4. File uploads: disk → SHA-256 → Sepolia anchor → MySQL row.
5. Health chat: Node spawns `apps/rag-service/app.py` with patient context.

## Shared config

- Secrets: `apps/backend/src/config/env.js` (local `.env` today; AWS Secrets Manager in v2.0).
- Canned RAG responses: `apps/rag-service/canned_responses.json` (read by frontend and Python).

For the full historical architecture analysis, see `.project-context/ARCHITECTURE.md`.
