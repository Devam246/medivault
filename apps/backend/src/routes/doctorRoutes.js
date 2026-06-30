import express from "express";
import {
  getDoctorDashboard,
  searchPatient,
  getPatientHistory
} from "../controllers/doctorController.js";
import { getDoctorAppointments, getDoctorAvailability, updateDoctorAvailability } from "../controllers/appointmentController.js";
import { createPrescription, getPrescriptionsForPatientByDoctor } from "../controllers/prescriptionController.js";

import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Doctor dashboard
router.get(
  "/dashboard",
  authenticateToken,
  requireRole("doctor"),
  getDoctorDashboard
);

router.get(
  "/appointments",
  authenticateToken,
  requireRole("doctor"),
  getDoctorAppointments
);

// Patient search
router.get(
  "/search",
  authenticateToken,
  requireRole("doctor"),
  searchPatient
);

router.get(
  "/patient/:id/history",
  authenticateToken,
  requireRole("doctor"),
  getPatientHistory
);

// New: create prescription
router.post("/prescriptions", authenticateToken, requireRole("doctor"), createPrescription);

// Optional: doctor view prescriptions for a patient
router.get("/prescriptions/patient/:patientId", authenticateToken, requireRole("doctor"), getPrescriptionsForPatientByDoctor);

router.get("/availability", authenticateToken, requireRole("doctor"), getDoctorAvailability);
router.put("/availability", authenticateToken, requireRole("doctor"), updateDoctorAvailability);

export default router;
