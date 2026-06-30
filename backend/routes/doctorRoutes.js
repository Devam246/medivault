import express from "express";
import {
  getDoctorDashboard,
  searchPatient,
  getPatientHistory
} from "../controllers/doctorController.js";
import { getDoctorAppointments } from "../controllers/appointmentController.js";
import { createPrescription, getPrescriptionsForPatientByDoctor } from "../controllers/prescriptionController.js";
import db from "../config/db.js"; //  Add this import

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

router.get("/availability", authenticateToken, requireRole("doctor"), async (req, res) => {
  try {
    const doctorId = req.user.id;
    
    const [rows] = await db.query(
      `SELECT available_days, available_time_start, available_time_end, slot_duration 
       FROM doctor_profiles 
       WHERE user_id = ?`,
      [doctorId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Doctor profile not found" });
    }

    const profile = rows[0];
    
    // Convert database format to frontend format
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayMap = { 'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday', 
                     'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday' };
    
    const availableDaysArray = profile.available_days ? profile.available_days.split(',') : [];
    
    const availability = {};
    days.forEach(day => {
      const isEnabled = availableDaysArray.some(dbDay => dayMap[dbDay] === day);
      availability[day] = {
        enabled: isEnabled,
        start: profile.available_time_start ? profile.available_time_start.slice(0, 5) : '09:00',
        end: profile.available_time_end ? profile.available_time_end.slice(0, 5) : '17:00'
      };
    });

    return res.json({ availability });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return res.status(500).json({ message: "Server error" });
  }
});

// Update doctor's availability settings
router.put("/availability", authenticateToken, requireRole("doctor"), async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;

    // Convert frontend format to database format
    const availableDays = [];
    const dayMap = { 
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', 
      friday: 'Fri', saturday: 'Sat', sunday: 'Sun' 
    };
    
    let earliestStart = '23:59';
    let latestEnd = '00:00';
    
    Object.entries({ monday, tuesday, wednesday, thursday, friday, saturday, sunday }).forEach(([day, settings]) => {
      if (settings.enabled) {
        availableDays.push(dayMap[day]);
        if (settings.start < earliestStart) earliestStart = settings.start;
        if (settings.end > latestEnd) latestEnd = settings.end;
      }
    });

    // Update doctor profile
    await db.query(
      `UPDATE doctor_profiles 
       SET available_days = ?, 
           available_time_start = ?, 
           available_time_end = ?
       WHERE user_id = ?`,
      [availableDays.join(','), earliestStart + ':00', latestEnd + ':00', doctorId]
    );

    return res.json({ message: "Availability updated successfully" });
  } catch (error) {
    console.error('Error updating availability:', error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
