// ==========================================
// patientRoutes.js
// ==========================================
import express from "express";
import db from "../config/db.js";
import { 
  getPatientProfile, 
  updatePatientProfile,
  getMedicalRecords,
  deleteMedicalRecord,
  getAppointments,
  bookAppointment,
  cancelAppointment,
  getPrescriptions,
  getVitalSigns,
  addVitalSigns,
  getDashboardOverview,
} from "../controllers/patientController.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { patientRagChat } from "../controllers/ragController.js";
import { grantEasyAccess } from "../controllers/appointmentController.js";

const router = express.Router();

// All routes require authentication and patient role
router.use(authenticateToken);
router.use(requireRole('patient'));

// =======================
// PROFILE ROUTES
// =======================
router.get("/profile", getPatientProfile);
router.put("/profile", updatePatientProfile);

// =======================
// MEDICAL RECORDS ROUTES
// =======================
router.get("/medical-records", getMedicalRecords);
// Upload: use POST /files/upload only (hash + blockchain + JSON + MySQL)
router.delete("/medical-records/:recordId", deleteMedicalRecord);

// =======================
// APPOINTMENTS ROUTES
// =======================
router.get("/appointments", getAppointments);
router.post("/appointments", bookAppointment);
router.put("/appointments/:appointmentId/cancel", cancelAppointment);
router.post("/appointments/:appointmentId/easy-access", grantEasyAccess);

// =======================
// PRESCRIPTIONS ROUTES
// =======================
router.get("/prescriptions", getPrescriptions);

// =======================
// VITAL SIGNS ROUTES
// =======================
router.get("/vital-signs", getVitalSigns);
router.post("/vital-signs", addVitalSigns);

// =======================
// DASHBOARD ROUTES
// =======================
router.get("/dashboard", getDashboardOverview);

// =======================
// RAG HEALTH CHAT (Groq + patient history)
// =======================
router.post("/rag/chat", patientRagChat);

// =======================
// SUMMARY ROUTES (TODO: Add these functions to controller if needed)
// =======================
// router.get('/summary', getPatientSummary);
// router.get('/summary/history', getSummaryHistory);
// router.get('/:id/summary', getPatientSummary);

// =======================
// DOCTOR SEARCH ROUTE
// =======================
router.get("/search", async (req, res, next) => {
  try {
    const query = req.query.query || '';
    let sql = `
      SELECT 
        u.id, u.name, u.email, u.phone,
        dp.specialty, dp.qualification, dp.experience_years,
        dp.location, dp.consultation_fee
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'doctor' AND u.is_verified = 1
    `;
    
    const params = [];
    
    if (query && query !== 'all') {
      sql += ` AND (
        u.name LIKE ? OR 
        dp.specialty LIKE ? OR 
        dp.location LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    sql += ` ORDER BY u.name`;
    
    const [doctors] = await db.query(sql, params);
    
    return res.json({ doctors });
  } catch (error) {
    next(error);
  }
});

export default router;