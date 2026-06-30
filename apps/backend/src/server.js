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
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = resolve(__dirname, "../uploads");
export const app = express();
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ MySQL Connected Successfully");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
  }
})();
const allowedOrigin = "http://localhost:5173";
console.log(">>> SERVER STARTED <<<");

app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
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

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

export default app;
