// /mnt/data/patientController.js
import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import path from "path";
import fs from "fs";
import { isMongoEnabled } from "../config/mongo.js";
import {
  createAppointment as createMongoAppointment,
  createVitalSign,
  deleteMedicalRecord as deleteMongoMedicalRecord,
  findMedicalRecordForPatient,
  getPatientProfile as getMongoPatientProfile,
  getUserById,
  listAppointmentsByPatient,
  listMedicalRecords,
  listPrescriptions,
  listVitals,
  updatePatientProfile as updateMongoPatientProfile,
} from "../repositories/mongoRepository.js";

// Medical file upload is handled only by routes/fileRoutes.js → POST /files/upload

// --------------------
// GET PATIENT PROFILE
// --------------------
export async function getPatientProfile(req, res, next) {
  try {
    const userId = req.user.id; // from auth middleware

    if (isMongoEnabled()) {
      const patient = await getMongoPatientProfile(userId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      return res.json({ patient });
    }

    const [rows] = await db.query(
      `SELECT id, name, email, date_of_birth, blood_group, phone, 
       address, emergency_contact, created_at 
       FROM users WHERE id = ? AND role = 'patient'`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Patient not found" });
    }

    return res.json({ patient: rows[0] });
  } catch (err) {
    next(err);
  }
}

// --------------------
// UPDATE PATIENT PROFILE
// --------------------
export async function updatePatientProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, dateOfBirth, bloodGroup, phone, address, emergencyContact } = req.body;

    if (isMongoEnabled()) {
      await updateMongoPatientProfile(userId, {
        name,
        date_of_birth: dateOfBirth,
        blood_group: bloodGroup,
        phone,
        address,
        emergency_contact: emergencyContact,
      });
      return res.json({ message: "Profile updated successfully" });
    }

    await db.query(
      `UPDATE users SET 
        name = ?,
        date_of_birth = ?,
        blood_group = ?,
        phone = ?,
        address = ?,
        emergency_contact = ?
       WHERE id = ? AND role = 'patient'`,
      [name, dateOfBirth, bloodGroup, phone, address, emergencyContact, userId]
    );

    return res.json({ message: "Profile updated successfully" });
  } catch (err) {
    next(err);
  }
}

// --------------------
// GET MEDICAL RECORDS
// --------------------
export async function getMedicalRecords(req, res, next) {
  try {
    const userId = req.user.id;

    if (isMongoEnabled()) {
      const records = await listMedicalRecords(userId);
      return res.json({ records });
    }

    const [records] = await db.query(
      `SELECT mr.*, u.name as doctor_name 
       FROM medical_records mr
       LEFT JOIN users u ON mr.doctor_id = u.id
       WHERE mr.patient_id = ?
       ORDER BY mr.record_date DESC`,
      [userId]
    );

    return res.json({ records });
  } catch (err) {
    next(err);
  }
}

// --------------------
// DELETE MEDICAL RECORD
// --------------------
export async function deleteMedicalRecord(req, res, next) {
  try {
    const userId = req.user.id;
    const { recordId } = req.params;

    if (isMongoEnabled()) {
      const record = await findMedicalRecordForPatient(recordId, userId);
      if (!record) {
        return res.status(404).json({ message: "Record not found" });
      }
      await deleteMongoMedicalRecord(recordId);
      if (record.file_path) {
        const fullPath = path.join(process.cwd(), record.file_path);
        try {
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        } catch (fsErr) {
          console.error('Failed to unlink file:', fsErr);
        }
      }
      return res.json({ message: "Record deleted successfully" });
    }

    // Check if record belongs to patient
    const [recordRows] = await db.query(
      "SELECT * FROM medical_records WHERE id = ? AND patient_id = ?",
      [recordId, userId]
    );

    if (!recordRows.length) {
      return res.status(404).json({ message: "Record not found" });
    }

    const record = recordRows[0];

    // Delete DB row
    await db.query("DELETE FROM medical_records WHERE id = ?", [recordId]);

    // Remove file from disk if present
    if (record.file_path) {
      const fullPath = path.join(process.cwd(), record.file_path);
      try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch (fsErr) {
        console.error('Failed to unlink file:', fsErr);
      }
    }

    return res.json({ message: "Record deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// --------------------
// GET APPOINTMENTS
// --------------------
export async function getAppointments(req, res, next) {
  try {
    const userId = req.user.id;

    if (isMongoEnabled()) {
      const appointments = await listAppointmentsByPatient(userId);
      return res.json({ appointments });
    }

    const [appointments] = await db.query(
      `SELECT a.*, u.name as doctor_name, d.specialty
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       LEFT JOIN doctor_profiles d ON u.id = d.user_id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [userId]
    );

    return res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

// --------------------
// BOOK APPOINTMENT
// --------------------
export async function bookAppointment(req, res, next) {
  try {
    const userId = req.user.id;
    const { doctorId, appointmentDate, appointmentTime, reason } = req.body;

    if (!doctorId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if doctor exists and is verified
    if (isMongoEnabled()) {
      const doctor = await getUserById(doctorId);
      if (!doctor || doctor.role !== "doctor" || doctor.is_verified !== 1) {
        return res.status(404).json({ message: "Doctor not found or not verified" });
      }
      try {
        const appointment = await createMongoAppointment({
          patient_id: userId,
          doctor_id: doctorId,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          reason: reason || null,
          status: "pending",
        });
        return res.json({
          message: "Appointment booked successfully",
          appointmentId: appointment.id
        });
      } catch (err) {
        if (err.code === 11000) {
          return res.status(400).json({ message: "This time slot is already booked" });
        }
        throw err;
      }
    }

    // Check if doctor exists and is verified
    const [doctor] = await db.query(
      "SELECT id FROM users WHERE id = ? AND role = 'doctor' AND is_verified = 1",
      [doctorId]
    );

    if (!doctor.length) {
      return res.status(404).json({ message: "Doctor not found or not verified" });
    }

    // Check for existing appointment at same time
    const [existing] = await db.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
       AND status != 'cancelled'`,
      [doctorId, appointmentDate, appointmentTime]
    );

    if (existing.length) {
      return res.status(400).json({ message: "This time slot is already booked" });
    }

    const [result] = await db.query(
      `INSERT INTO appointments 
        (patient_id, doctor_id, appointment_date, appointment_time, reason, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, doctorId, appointmentDate, appointmentTime, reason || null]
    );

    return res.json({
      message: "Appointment booked successfully",
      appointmentId: result.insertId
    });
  } catch (err) {
    next(err);
  }
}

// --------------------
// CANCEL APPOINTMENT
// --------------------
export async function cancelAppointment(req, res, next) {
  try {
    const userId = req.user.id;
    const { appointmentId } = req.params;

    if (isMongoEnabled()) {
      const appointments = await listAppointmentsByPatient(userId);
      const appointment = appointments.find((item) => Number(item.id) === Number(appointmentId));
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      const { updateAppointmentStatus } = await import("../repositories/mongoRepository.js");
      await updateAppointmentStatus(appointmentId, "cancelled");
      return res.json({ message: "Appointment cancelled successfully" });
    }

    const [appointment] = await db.query(
      "SELECT * FROM appointments WHERE id = ? AND patient_id = ?",
      [appointmentId, userId]
    );

    if (!appointment.length) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    await db.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
      [appointmentId]
    );

    return res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    next(err);
  }
}

// --------------------
// GET PRESCRIPTIONS
// --------------------
export async function getPrescriptions(req, res, next) {
  try {
    const userId = req.user.id;

    if (isMongoEnabled()) {
      const prescriptions = await listPrescriptions(userId);
      return res.json({ prescriptions });
    }

    const [prescriptions] = await db.query(
      `SELECT p.*, u.name as doctor_name
       FROM prescriptions p
       JOIN users u ON p.doctor_id = u.id
       WHERE p.patient_id = ?
       ORDER BY p.prescribed_date DESC`,
      [userId]
    );

    return res.json({ prescriptions });
  } catch (err) {
    next(err);
  }
}

// --------------------
// GET VITAL SIGNS
// --------------------
export async function getVitalSigns(req, res, next) {
  try {
    const userId = req.user.id;

    if (isMongoEnabled()) {
      const vitals = await listVitals(userId);
      return res.json({ vitals });
    }

    const [vitals] = await db.query(
      `SELECT * FROM vital_signs 
       WHERE patient_id = ?
       ORDER BY recorded_date DESC`,
      [userId]
    );

    return res.json({ vitals });
  } catch (err) {
    next(err);
  }
}

// --------------------
// ADD VITAL SIGNS
// --------------------
export async function addVitalSigns(req, res, next) {
  try {
    const userId = req.user.id;
    const { bloodPressure, heartRate, temperature, weight, recordedDate, notes } = req.body;

    if (isMongoEnabled()) {
      const vital = await createVitalSign({
        patient_id: userId,
        blood_pressure: bloodPressure || null,
        heart_rate: heartRate || null,
        temperature: temperature || null,
        weight: weight || null,
        recorded_date: recordedDate || new Date(),
        notes: notes || null,
      });
      return res.json({
        message: "Vital signs added successfully",
        vitalId: vital.id
      });
    }

    const [result] = await db.query(
      `INSERT INTO vital_signs 
        (patient_id, blood_pressure, heart_rate, temperature, weight, recorded_date, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, bloodPressure || null, heartRate || null, temperature || null, weight || null, recordedDate || new Date(), notes || null]
    );

    return res.json({
      message: "Vital signs added successfully",
      vitalId: result.insertId
    });
  } catch (err) {
    next(err);
  }
}

// --------------------
// GET DASHBOARD OVERVIEW
// --------------------
export async function getDashboardOverview(req, res, next) {
  try {
    const userId = req.user.id;

    if (isMongoEnabled()) {
      const [upcomingAppointments, latestVitals, activePrescriptions, recentRecords] = await Promise.all([
        listAppointmentsByPatient(userId).then((rows) =>
          rows
            .filter((appointment) => String(appointment.appointment_date) >= new Date().toISOString().slice(0, 10))
            .sort((a, b) => String(a.appointment_date).localeCompare(String(b.appointment_date)))
            .slice(0, 3)
        ),
        listVitals(userId, 1).then((rows) => rows[0] || null),
        listPrescriptions(userId, 5, true),
        listMedicalRecords(userId, 5),
      ]);

      return res.json({
        upcomingAppointments,
        latestVitals,
        activePrescriptions,
        recentRecords
      });
    }

    // Get upcoming appointments
    const [upcomingAppointments] = await db.query(
      `SELECT a.*, u.name as doctor_name, d.specialty
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       LEFT JOIN doctor_profiles d ON u.id = d.user_id
       WHERE a.patient_id = ? AND a.appointment_date >= CURDATE()
       ORDER BY a.appointment_date ASC, a.appointment_time ASC
       LIMIT 3`,
      [userId]
    );

    // Get latest vitals
    const [latestVitals] = await db.query(
      `SELECT * FROM vital_signs 
       WHERE patient_id = ?
       ORDER BY recorded_date DESC
       LIMIT 1`,
      [userId]
    );

    // Get active prescriptions
    const [activePrescriptions] = await db.query(
      `SELECT p.*, u.name as doctor_name
       FROM prescriptions p
       JOIN users u ON p.doctor_id = u.id
       WHERE p.patient_id = ? AND p.end_date >= CURDATE()
       ORDER BY p.prescribed_date DESC
       LIMIT 5`,
      [userId]
    );

    // Get recent medical records
    const [recentRecords] = await db.query(
      `SELECT mr.*, u.name as doctor_name 
       FROM medical_records mr
       LEFT JOIN users u ON mr.doctor_id = u.id
       WHERE mr.patient_id = ?
       ORDER BY mr.record_date DESC
       LIMIT 5`,
      [userId]
    );

    return res.json({
      upcomingAppointments,
      latestVitals: latestVitals[0] || null,
      activePrescriptions,
      recentRecords
    });
  } catch (err) {
    next(err);
  }
}

