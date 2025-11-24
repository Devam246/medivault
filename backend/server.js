import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";


export const app = express();

const allowedOrigin = "http://localhost:5173";

console.log(">>> SERVER STARTED (server.js running) <<<");

app.use((req, res, next) => {
  console.log("REQ:", req.method, req.path, "ORIGIN:", req.headers.origin);
  next();
});


// FORCE correct CORS for all requests, including OPTIONS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", allowedOrigin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));
app.use("/auth", authRoutes);
app.use("/patient", patientRoutes);
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

export default app; 