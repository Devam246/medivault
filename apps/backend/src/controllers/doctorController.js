import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";
import { isMongoEnabled } from "../config/mongo.js";
import {
  findActiveGrant,
  getPatientHistoryBundle,
  listAppointmentsByDoctor,
  listMedicalRecords,
  listPrescriptionsForDoctorPatient,
  searchPatients,
} from "../repositories/mongoRepository.js";

export async function getDoctorDashboard(req, res, next) {
  try {
    const doctorId = req.user.id;

    if (isMongoEnabled()) {
      const appointments = await listAppointmentsByDoctor(doctorId);
      const today = new Date().toISOString().slice(0, 10);
      const todayAppointments = appointments
        .filter((appointment) => appointment.appointment_date === today)
        .sort((a, b) => String(a.appointment_time).localeCompare(String(b.appointment_time)));
      const totalPatients = new Set(appointments.map((appointment) => appointment.patient_id)).size;
      const recentPrescriptions = [];
      const recentRecords = (await Promise.all(
        [...new Set(appointments.map((appointment) => appointment.patient_id))]
          .map((patientId) => listMedicalRecords(patientId, 5))
      )).flat()
        .filter((record) => Number(record.doctor_id) === Number(doctorId))
        .sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)))
        .slice(0, 5);

      return res.json({
        todayAppointments,
        totalPatients,
        recentPrescriptions,
        recentRecords,
      });
    }

    const [todayAppointments] = await db.query(
      `SELECT a.*, u.name AS patient_name FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
       ORDER BY a.appointment_time ASC`,
      [doctorId]
    );

    const [patientCount] = await db.query(
      `SELECT COUNT(DISTINCT patient_id) AS total FROM appointments WHERE doctor_id = ?`,
      [doctorId]
    );

    const [recentPrescriptions] = await db.query(
      `SELECT p.*, u.name AS patient_name FROM prescriptions p
       JOIN users u ON p.patient_id = u.id
       WHERE p.doctor_id = ? ORDER BY p.prescribed_date DESC LIMIT 5`,
      [doctorId]
    );

    const [recentRecords] = await db.query(
      `SELECT mr.*, u.name AS patient_name FROM medical_records mr
       JOIN users u ON mr.patient_id = u.id
       WHERE mr.doctor_id = ? ORDER BY mr.record_date DESC LIMIT 5`,
      [doctorId]
    );

    return res.json({
      todayAppointments,
      totalPatients: patientCount[0].total,
      recentPrescriptions,
      recentRecords,
    });
  } catch (err) {
    next(err);
  }
}

export async function searchPatient(req, res, next) {
  try {
    const { query } = req.query;
    if (!query || query.trim() === "") {
      return res.json({ patients: [] });
    }

    if (isMongoEnabled()) {
      const patients = await searchPatients(query);
      return res.json({ patients });
    }

    const [patients] = await db.query(
      `SELECT id, name, email, phone, blood_group FROM users
       WHERE role='patient' AND (id = ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)`,
      [query, `%${query}%`, `%${query}%`, `%${query}%`]
    );

    return res.json({ patients });
  } catch (err) {
    next(err);
  }
}

export async function getPatientHistory(req, res, next) {
  try {
    const patientId = req.params.id;
    const doctorId = req.user.id;

    if (isMongoEnabled()) {
      const grant = await findActiveGrant(patientId, doctorId);
      if (!grant) {
        throw new AppError(
          "No active access grant. Ask the patient to tap Easy Access, or use Emergency Access.",
          403,
          "ACCESS_DENIED"
        );
      }

      const bundle = await getPatientHistoryBundle(patientId);
      if (!bundle.profile) {
        throw new AppError("Patient not found", 404, "NOT_FOUND");
      }
      return res.json(bundle);
    }

    const [grantRows] = await db.query(
      `SELECT id, expires_at FROM patient_access_tokens
       WHERE patient_id = ? AND doctor_id = ? AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 1`,
      [patientId, doctorId]
    );

    if (grantRows.length === 0) {
      throw new AppError(
        "No active access grant. Ask the patient to tap Easy Access, or use Emergency Access.",
        403,
        "ACCESS_DENIED"
      );
    }

    const [profile] = await db.query(
      `SELECT id, name, email, phone, address, date_of_birth, blood_group, emergency_contact
       FROM users WHERE id = ? AND role='patient'`,
      [patientId]
    );

    if (profile.length === 0) {
      throw new AppError("Patient not found", 404, "NOT_FOUND");
    }

    const [vitals] = await db.query(
      `SELECT * FROM vital_signs WHERE patient_id=? ORDER BY recorded_date DESC`,
      [patientId]
    );
    const [records] = await db.query(
      `SELECT * FROM medical_records WHERE patient_id=? ORDER BY record_date DESC`,
      [patientId]
    );
    const [prescriptions] = await db.query(
      `SELECT p.*, d.name AS doctor_name FROM prescriptions p
       JOIN users d ON p.doctor_id = d.id WHERE patient_id=? ORDER BY prescribed_date DESC`,
      [patientId]
    );
    const [appointments] = await db.query(
      `SELECT a.*, d.name AS doctor_name FROM appointments a
       JOIN users d ON a.doctor_id = d.id WHERE patient_id=? ORDER BY appointment_date DESC`,
      [patientId]
    );

    return res.json({ profile: profile[0], vitals, records, prescriptions, appointments });
  } catch (err) {
    next(err);
  }
}
