import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function deactivateAccessTokens(patientId, doctorId) {
  if (isMongoEnabled()) {
    return mongo.deactivateAccessTokens(patientId, doctorId);
  }
  await db.query(
    `UPDATE patient_access_tokens
     SET is_active = FALSE
     WHERE patient_id = ?
       AND doctor_id = ?
       AND is_active = TRUE`,
    [Number(patientId), Number(doctorId)]
  );
}

export async function createPatientAccessToken(payload) {
  if (isMongoEnabled()) {
    return mongo.createPatientAccessToken(payload);
  }
  const { patient_id, token, appointment_id, doctor_id, expires_at } = payload;
  const [result] = await db.query(
    `INSERT INTO patient_access_tokens
     (patient_id, token, appointment_id, doctor_id, expires_at, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, TRUE, NOW())`,
    [
      Number(patient_id),
      token,
      appointment_id ? Number(appointment_id) : null,
      Number(doctor_id),
      expires_at,
    ]
  );
  return { id: result.insertId, ...payload };
}

export async function findActiveAccessToken(token, doctorId) {
  if (isMongoEnabled()) {
    return mongo.findActiveAccessToken(token, doctorId);
  }
  const [rows] = await db.query(
    `SELECT * FROM patient_access_tokens 
     WHERE token = ? 
     AND doctor_id = ? 
     AND is_active = TRUE 
     AND (expires_at IS NULL OR expires_at > NOW())`,
    [token, Number(doctorId)]
  );
  return rows[0] || null;
}

export async function findActiveGrant(patientId, doctorId) {
  if (isMongoEnabled()) {
    return mongo.findActiveGrant(patientId, doctorId);
  }
  const [rows] = await db.query(
    `SELECT id, expires_at FROM patient_access_tokens
     WHERE patient_id = ? AND doctor_id = ? AND is_active = TRUE
     AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC LIMIT 1`,
    [Number(patientId), Number(doctorId)]
  );
  return rows[0] || null;
}

export async function markAccessTokenUsed(id) {
  if (isMongoEnabled()) {
    return mongo.markAccessTokenUsed(id);
  }
  await db.query(
    `UPDATE patient_access_tokens SET used_at = NOW() WHERE id = ?`,
    [Number(id)]
  );
}
