import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointments.js";
import doctorsSearchRoutes from './routes/doctors.js'; // For searching doctors


export const app = express();

const allowedOrigin = "http://localhost:5173";
console.log(">>> SERVER STARTED <<<");

// CORS FIRST
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));

// Allow parsing JSON (must be BEFORE routes!)
app.use(express.json());
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

// Static
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/auth", authRoutes);
app.use("/patient", patientRoutes);
app.use("/doctor", doctorRoutes);
app.use("/appointments", appointmentRoutes);
app.use('/doctors', doctorsSearchRoutes); // /doctors/search - patients search doctors

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

export default app;
