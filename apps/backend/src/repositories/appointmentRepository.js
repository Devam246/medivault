import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function createAppointment(payload) {
  if (isMongoEnabled()) {
    return mongo.createAppointment(payload);
  }
  const { patient_id, doctor_id, appointment_date, appointment_time, reason, status } = payload;
  const [result] = await db.query(
    `INSERT INTO appointments 
      (patient_id, doctor_id, appointment_date, appointment_time, reason, status) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      Number(patient_id),
      Number(doctor_id),
      appointment_date,
      appointment_time,
      reason || null,
      status || "pending",
    ]
  );
  return { id: result.insertId, ...payload };
}

export async function findAppointmentById(id) {
  if (isMongoEnabled()) {
    return mongo.findAppointmentById(id);
  }
  const [rows] = await db.query("SELECT * FROM appointments WHERE id = ?", [Number(id)]);
  return rows[0] || null;
}

export async function updateAppointmentStatus(id, status) {
  if (isMongoEnabled()) {
    return mongo.updateAppointmentStatus(id, status);
  }
  await db.query("UPDATE appointments SET status = ? WHERE id = ?", [status, Number(id)]);
}

export async function listAppointmentsByPatient(patientId) {
  if (isMongoEnabled()) {
    return mongo.listAppointmentsByPatient(patientId);
  }
  const [rows] = await db.query(
    `SELECT a.*, u.name AS doctor_name, dp.specialty, pat.token AS access_token, pat.expires_at AS token_expiry
     FROM appointments a
     JOIN users u ON a.doctor_id = u.id
     LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
     LEFT JOIN patient_access_tokens pat ON a.id = pat.appointment_id AND pat.is_active = TRUE
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [Number(patientId)]
  );
  return rows;
}

export async function listAppointmentsByDoctor(doctorId) {
  if (isMongoEnabled()) {
    return mongo.listAppointmentsByDoctor(doctorId);
  }
  const [rows] = await db.query(
    `SELECT a.*, u.name AS patient_name, u.email AS patient_email, u.phone AS patient_phone, pat.token AS access_token
     FROM appointments a
     JOIN users u ON a.patient_id = u.id
     LEFT JOIN patient_access_tokens pat ON a.id = pat.appointment_id AND pat.is_active = TRUE
     WHERE a.doctor_id = ?
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    [Number(doctorId)]
  );
  return rows;
}

export async function getBookedTimes(doctorId, date) {
  if (isMongoEnabled()) {
    return mongo.getBookedTimes(doctorId, date);
  }
  const [rows] = await db.query(
    `SELECT appointment_time FROM appointments 
     WHERE doctor_id = ? AND appointment_date = ? AND status IN ('confirmed', 'pending')`,
    [Number(doctorId), date]
  );
  return new Set(rows.map((r) => r.appointment_time));
}
