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
  getPatientHistoryWithToken
} from "../controllers/appointmentController.js";

import { getPatientHistoryWithToken } from '../controllers/appointmentController.js';
// Patient Routes
router.post("/", authenticateToken, requireRole("patient"), bookAppointment);
router.get("/patient", authenticateToken, requireRole("patient"), getPatientAppointments);
router.post("/:id/cancel", authenticateToken, requireRole("patient"), cancelAppointment);

// Doctor Routes - IMPORTANT: Specific routes MUST come before general routes
// Put /doctor/availability BEFORE /doctor/:doctorId/slots
router.get("/doctor/availability", authenticateToken, requireRole("doctor"), getDoctorAvailability);
router.put("/doctor/availability", authenticateToken, requireRole("doctor"), updateDoctorAvailability);

// This route should come after /doctor/availability to avoid conflicts
router.get("/doctor/:doctorId/slots", authenticateToken, getAvailableSlots);

// General doctor route - This should be LAST among doctor routes
router.get("/doctor", authenticateToken, requireRole("doctor"), getDoctorAppointments);

// Appointment response route
router.post("/:id/respond", authenticateToken, requireRole("doctor"), respondToAppointment);

// Patient history access with token (for doctors)
router.get("/patient-history/:token", authenticateToken, requireRole("doctor"), getPatientHistoryWithToken);
export default router;