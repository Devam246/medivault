import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointments.js";
import doctorsSearchRoutes from './routes/doctors.js';
import fileRoutes from "./routes/fileRoutes.js";
import db from "./config/db.js";
import { isMongoEnabled, getMongoDb, ensureMongoIndexes } from "./config/mongo.js";
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = resolve(__dirname, "../uploads");
export const app = express();

export async function initializeDatabase() {
  if (isMongoEnabled()) {
    try {
      await getMongoDb();
      await ensureMongoIndexes();
      console.log("✅ MongoDB Connected & Indexes Ensured Successfully");
    } catch (err) {
      console.error("❌ MongoDB Connection Failed:", err.message);
    }
  } else {
    try {
      const conn = await db.getConnection();
      console.log("✅ MySQL Connected Successfully");
      conn.release();
    } catch (err) {
      console.error("❌ MySQL Connection Failed:", err.message);
    }
  }
}

export async function startServer(port = 4000) {
  await initializeDatabase();
  return app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Read the allowed frontend origin from env — set FRONTEND_URL in .env or inject via Docker/ECS.
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";
console.log(">>> SERVER STARTED <<<");

app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// Health check endpoint — used by AWS ALB, ECS, and docker-compose healthcheck
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
// CORS FIRST
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Allow parsing JSON (must be BEFORE routes!)
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// FIX: unified CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // allow OPTIONS to fall through for express.json()
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Ensure uploads directory exists before serving static files
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Static
app.use("/uploads", express.static(UPLOAD_DIR));
// import summaryRoutes from './routes/summaryRoutes.js';
// Routes
app.use("/auth", authRoutes);
app.use("/admin", authenticateToken, adminRoutes);
app.use("/patient", patientRoutes);
app.use("/doctor", doctorRoutes);
app.use("/appointments", appointmentRoutes);
app.use('/doctors', doctorsSearchRoutes); // /doctors/search - patients search doctors
app.use("/files", fileRoutes);
// app.use('/api/summary', summaryRoutes);

// Global error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export default app;
