import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function listVitals(patientId, limit = 0) {
  if (isMongoEnabled()) {
    return mongo.listVitals(patientId, limit);
  }
  let sql = "SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY recorded_date DESC";
  const params = [Number(patientId)];
  if (limit > 0) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function createVitalSign(payload) {
  if (isMongoEnabled()) {
    return mongo.createVitalSign(payload);
  }
  const { patient_id, blood_pressure, heart_rate, temperature, weight, recorded_date, notes } = payload;
  const [result] = await db.query(
    `INSERT INTO vital_signs 
      (patient_id, blood_pressure, heart_rate, temperature, weight, recorded_date, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(patient_id),
      blood_pressure || null,
      heart_rate !== null ? Number(heart_rate) : null,
      temperature !== null ? Number(temperature) : null,
      weight !== null ? Number(weight) : null,
      recorded_date,
      notes || null,
    ]
  );
  return { id: result.insertId, ...payload };
}

export async function getPatientHistoryBundle(patientId) {
  if (isMongoEnabled()) {
    return mongo.getPatientHistoryBundle(patientId);
  }
  // This helper maps exactly to the controller expectation
  const [profileRows] = await db.query(
    `SELECT id, name, email, phone, address, date_of_birth, blood_group, emergency_contact
     FROM users WHERE id = ? AND role='patient'`,
    [Number(patientId)]
  );
  if (profileRows.length === 0) return { profile: null };

  const [vitals, records, prescriptions, appointments] = await Promise.all([
    listVitals(patientId),
    // Fetch all medical records
    db.query(`SELECT mr.*, u.name AS doctor_name FROM medical_records mr LEFT JOIN users u ON mr.doctor_id = u.id WHERE mr.patient_id = ? ORDER BY mr.record_date DESC`, [Number(patientId)]).then(([r]) => r),
    // Fetch all prescriptions
    db.query(`SELECT p.*, d.name AS doctor_name FROM prescriptions p JOIN users d ON p.doctor_id = d.id WHERE patient_id=? ORDER BY prescribed_date DESC`, [Number(patientId)]).then(([r]) => r),
    // Fetch all appointments
    db.query(`SELECT a.*, d.name AS doctor_name FROM appointments a JOIN users d ON a.doctor_id = d.id WHERE patient_id=? ORDER BY appointment_date DESC`, [Number(patientId)]).then(([r]) => r),
  ]);

  return { profile: profileRows[0], vitals, records, prescriptions, appointments };
}
