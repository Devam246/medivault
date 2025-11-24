
// ==========================================
// patientRoutes.js
// ==========================================
import express from "express";
import { 
  getPatientProfile, 
  updatePatientProfile,
  getMedicalRecords,
  uploadMedicalRecord,
  deleteMedicalRecord,
  getAppointments,
  bookAppointment,
  cancelAppointment,
  getPrescriptions,
  getVitalSigns,
  addVitalSigns,
  getDashboardOverview,
  upload
} from "../controllers/patientController.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and patient role
router.use(authenticateToken);
router.use(requireRole('patient'));

// Profile
router.get("/profile", getPatientProfile);
router.put("/profile", updatePatientProfile);

// Medical Records
router.get("/medical-records", getMedicalRecords);
router.post("/medical-records", upload.single('file'), uploadMedicalRecord);
router.delete("/medical-records/:recordId", deleteMedicalRecord);

// Appointments
router.get("/appointments", getAppointments);
router.post("/appointments", bookAppointment);
router.put("/appointments/:appointmentId/cancel", cancelAppointment);


// Prescriptions
router.get("/prescriptions", getPrescriptions);

// Vital Signs
router.get("/vital-signs", getVitalSigns);
router.post("/vital-signs", addVitalSigns);

// Dashboard Overview
router.get("/dashboard", getDashboardOverview);

export default router;
