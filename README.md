# MediVault

MediVault is a healthcare platform where patients manage medical records, book appointments, and chat with an AI assistant over their own chart data. Doctors access patient history through time-boxed access grants. Records can be hash-anchored on-chain for tamper evidence.

## Local development

### Prerequisites

- Node.js 20+
- MySQL 8
- Python 3.9+ (for the RAG service subprocess)

### Setup

```bash
git clone <repo-url>
cd medivault
npm install
```

Create `apps/backend/.env` with at least:

```
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=medivault
JWT_SECRET=your_jwt_secret
PRIVATE_KEY=your_blockchain_private_key
GROQ_API_KEY=your_groq_key
```

Seed demo data (optional):

```bash
npm run seed:demo
```

### Run

Terminal 1 — API:

```bash
npm run dev:backend
```

Terminal 2 — frontend:

```bash
npm run dev:frontend
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Project layout

```
apps/backend/     Express API
apps/frontend/    React + Vite UI
apps/rag-service/ Python RAG subprocess
docs/             Changelog, decisions, architecture notes
```

For deeper system design, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
