import fs from "fs";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointments.js";
import doctorsSearchRoutes from './routes/doctors.js'; // For searching doctors
import fileRoutes from "./routes/fileRoutes.js";
import apiAuthRoutes from "./routes/apiAuthRoutes.js";
import apiTestRoutes from "./routes/apiTestRoutes.js";
import db from "./config/db.js";
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

// Ensure "uploads" directory exists before serving static files
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Static
app.use("/uploads", express.static("uploads"));
// import summaryRoutes from './routes/summaryRoutes.js';
// Routes
app.use("/auth", authRoutes);
app.use("/patient", patientRoutes);
app.use("/doctor", doctorRoutes);
app.use("/appointments", appointmentRoutes);
app.use('/doctors', doctorsSearchRoutes); // /doctors/search - patients search doctors
app.use("/files", fileRoutes);
app.use("/api/auth", apiAuthRoutes);
app.use("/api", apiTestRoutes);
// app.use('/api/summary', summaryRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

export default app;
