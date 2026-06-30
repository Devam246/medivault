import express from "express";
import multer from "multer";
import {
  registerPatient,
  registerDoctor,
  login,
  refresh
} from "../controllers/authController.js";
import { authLimiter } from "../middleware/rateLimiter.js";

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Multer for doctor file uploads (absolute path — safe regardless of CWD)
const upload = multer({ dest: resolve(__dirname, "../../uploads/documents/") });

// PATIENT REGISTRATION
router.post("/register", registerPatient);

// DOCTOR REGISTRATION
router.post("/register-doctor", upload.single("document"), registerDoctor);

// LOGIN & REFRESH
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refresh);

export default router;
