import express from "express";
const router = express.Router();
import { authenticateToken, requireRole } from "../middleware/auth.js";
import {
  bookAppointment,
  getPatientAppointments,
  cancelAppointment,
  getAvailableSlots,
  getDoctorAppointments,
  respondToAppointment,
  getDoctorAvailability,
  updateDoctorAvailability,
  getPatientHistoryWithToken,  // ✅ Only import once!
  grantEasyAccess,
  createEmergencyAccess
} from "../controllers/appointmentController.js";
import { validateRequest } from "../middleware/validate.js";
import {
  bookAppointmentSchema,
  respondToAppointmentSchema,
  grantEasyAccessSchema,
  createEmergencyAccessSchema
} from "../validators/appointmentValidator.js";
import { updateDoctorAvailabilitySchema } from "../validators/doctorValidator.js";

// ❌ REMOVE THIS DUPLICATE LINE - it was causing the error:
// import { getPatientHistoryWithToken } from '../controllers/appointmentController.js';

// =======================
// PATIENT ROUTES
// =======================
router.post("/", authenticateToken, requireRole("patient"), validateRequest(bookAppointmentSchema), bookAppointment);
router.get("/patient", authenticateToken, requireRole("patient"), getPatientAppointments);
router.post("/:id/cancel", authenticateToken, requireRole("patient"), cancelAppointment);

// =======================
// DOCTOR ROUTES
// =======================
// ⚠️ IMPORTANT: Specific routes MUST come before parameterized routes
// Put /doctor/availability BEFORE /doctor/:doctorId/slots

// Doctor's own availability settings
router.get("/doctor/availability", authenticateToken, requireRole("doctor"), getDoctorAvailability);
router.put("/doctor/availability", authenticateToken, requireRole("doctor"), validateRequest(updateDoctorAvailabilitySchema), updateDoctorAvailability);

// Doctor's appointments list
router.get("/doctor", authenticateToken, requireRole("doctor"), getDoctorAppointments);

// Respond to appointment (approve/decline)
router.post("/:id/respond", authenticateToken, requireRole("doctor"), validateRequest(respondToAppointmentSchema), respondToAppointment);

// Patient history access with token
router.get("/patient-history/:token", authenticateToken, requireRole("doctor"), getPatientHistoryWithToken);

// Patient: one-click easy access (30 min) for that appointment's doctor
router.post("/:id/easy-access", authenticateToken, requireRole("patient"), validateRequest(grantEasyAccessSchema), grantEasyAccess);

// Doctor: emergency access (30 min)
router.post("/emergency/:patientId", authenticateToken, requireRole("doctor"), validateRequest(createEmergencyAccessSchema), createEmergencyAccess);

// =======================
// SHARED ROUTES (Both Patient & Doctor can access)
// =======================
// Get available slots for a specific doctor (patients use this when booking)
router.get("/doctor/:doctorId/slots", authenticateToken, getAvailableSlots);

export default router;