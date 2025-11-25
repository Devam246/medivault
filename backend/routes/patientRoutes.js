
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

router.get("/search", authenticateToken, async (req, res) => {
  try {
    const query = req.query.query || '';
    const db = req.app.get('db'); // or however you access your db
    
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
    console.error('Error searching doctors:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
