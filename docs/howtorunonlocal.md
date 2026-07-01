# How to Run Locally

You can run the application either using **Docker Compose** (recommended and easiest) or via **manual local setup**.

#### Option A: Run via Docker Compose (Recommended)
This boots up MongoDB, the Express backend, and the React frontend automatically.
1. Make sure **Docker Desktop** is running on your machine.
2. Open PowerShell/Terminal in the project root directory (`c:\Base\my-react-app`) and run:
   ```powershell
   docker-compose up -d --build
   ```
3. To verify they are healthy, run:
   ```powershell
   docker-compose ps
   ```
4. Seed the database inside the running backend container:
   ```powershell
   docker compose exec backend node scripts/seedDemoData.js
   ```
5. Access the application:
   - **Frontend UI**: [http://localhost](http://localhost)
   - **Backend health API**: [http://localhost:4000/health](http://localhost:4000/health)

#### Option B: Manual Local Setup (Node/NPM)
This requires Node.js 20+, a database (MongoDB or MySQL 8), and Python 3.9+ installed locally.
1. Run `npm install` at the project root to install dependencies:
   ```powershell
   npm install
   ```
2. Set up your backend environment by creating a `.env` file at [apps/backend/.env](file:///c:/Base/my-react-app/apps/backend/.env) (refer to setup steps in [README.md](file:///c:/Base/my-react-app/README.md)).
3. Migrate and seed the database:
   ```powershell
   npm run migrate
   npm run seed:demo
   ```
4. Run the services in separate terminals:
   - **Terminal 1 (Backend)**:
     ```powershell
     npm run dev:backend
     ```
   - **Terminal 2 (Frontend)**:
     ```powershell
     npm run dev:frontend
     ```
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:4000](http://localhost:4000)

---

### 2. Demo Auth Credentials

These accounts are pre-configured through the seeding scripts.

#### A. Main Demo Accounts (Seeded via [seedDemoData.js](file:///c:/Base/my-react-app/apps/backend/scripts/seedDemoData.js))
* **Password for all accounts:** `Demo1234!`
* **Accounts:**
  * **Admin:** `admin+medivault-demo@medivault.test`
  * **Doctors:**
    * `doctor.aisha+medivault-demo@medivault.test`
    * `doctor.rohan+medivault-demo@medivault.test`
    * `doctor.sara+medivault-demo@medivault.test`
    * `doctor.vikram+medivault-demo@medivault.test`
  * **Patients:**
    * `patient.aryan+medivault-demo@medivault.test`
    * `patient.neha+medivault-demo@medivault.test`
    * `patient.kabir+medivault-demo@medivault.test`
    * `patient.meera+medivault-demo@medivault.test`

#### B. Quick Test Doctor Account (Seeded via [seedTestDoctor.js](file:///c:/Base/my-react-app/apps/backend/scripts/seedTestDoctor.js))
* **Email:** `abc123@gmail.com`
* **Password:** `1234`
* **Role:** Doctor

---
### Summary of Work
1. Analyzed the project layout and workspace configuration files including [README.md](file:///c:/Base/my-react-app/README.md) and [docker-compose.yml](file:///c:/Base/my-react-app/docker-compose.yml).
2. Found the database seeding scripts ([seedDemoData.js](file:///c:/Base/my-react-app/apps/backend/scripts/seedDemoData.js) and [seedTestDoctor.js](file:///c:/Base/my-react-app/apps/backend/scripts/seedTestDoctor.js)) to retrieve the email addresses and passwords of the default demo credentials.
3. Provided complete instructions to run the application locally both through Docker Compose and manual NPM installation.