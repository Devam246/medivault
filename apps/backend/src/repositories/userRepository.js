import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function getUserByEmail(email) {
  if (isMongoEnabled()) {
    return mongo.getUserByEmail(email);
  }
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

export async function getUserById(id) {
  if (isMongoEnabled()) {
    return mongo.getUserById(id);
  }
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [Number(id)]);
  return rows[0] || null;
}

export async function createUser(payload) {
  if (isMongoEnabled()) {
    return mongo.createUser(payload);
  }
  const { name, email, password_hash, role, is_verified, reg_number, degree, document_path } = payload;
  const [result] = await db.query(
    `INSERT INTO users 
      (name, email, password_hash, role, is_verified, reg_number, degree, document_path) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      password_hash,
      role,
      is_verified !== undefined ? is_verified : 0,
      reg_number || null,
      degree || null,
      document_path || null,
    ]
  );
  return { id: result.insertId, ...payload };
}

export async function updateUserPasswordHash(id, passwordHash) {
  if (isMongoEnabled()) {
    return mongo.updateUserPasswordHash(id, passwordHash);
  }
  await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, Number(id)]);
}

export async function listPendingDoctors() {
  if (isMongoEnabled()) {
    return mongo.listPendingDoctors();
  }
  const [rows] = await db.query(
    `SELECT id, name, email, reg_number AS regNumber, degree, document_path AS documentPath 
     FROM users WHERE role = 'doctor' AND is_verified = 0 ORDER BY name ASC`
  );
  return rows;
}

export async function approveDoctorById(id) {
  if (isMongoEnabled()) {
    return mongo.approveDoctorById(id);
  }
  const [result] = await db.query("UPDATE users SET is_verified = 1 WHERE id = ? AND role = 'doctor'", [Number(id)]);
  return result.affectedRows;
}

export async function rejectPendingDoctorById(id) {
  if (isMongoEnabled()) {
    return mongo.rejectPendingDoctorById(id);
  }
  const [result] = await db.query("DELETE FROM users WHERE id = ? AND role = 'doctor' AND is_verified = 0", [Number(id)]);
  return result.affectedRows;
}

export async function getSystemCounts() {
  if (isMongoEnabled()) {
    return mongo.getSystemCounts();
  }
  const [[userRow]] = await db.query("SELECT COUNT(*) AS total FROM users");
  const [[recordRow]] = await db.query("SELECT COUNT(*) AS total FROM medical_records");
  const [[appointmentRow]] = await db.query("SELECT COUNT(*) AS total FROM appointments");
  return {
    users: userRow.total,
    records: recordRow.total,
    appointments: appointmentRow.total,
  };
}

export async function upsertDoctorProfile(userId, payload) {
  if (isMongoEnabled()) {
    return mongo.upsertDoctorProfile(userId, payload);
  }
  const [existing] = await db.query("SELECT id FROM doctor_profiles WHERE user_id = ?", [Number(userId)]);
  const cols = Object.keys(payload);
  const vals = Object.values(payload);

  if (existing.length) {
    const updateExpr = cols.map((c) => `${c} = ?`).join(", ");
    await db.query(`UPDATE doctor_profiles SET ${updateExpr} WHERE user_id = ?`, [...vals, Number(userId)]);
  } else {
    const placeHolders = cols.map(() => "?").join(", ");
    await db.query(
      `INSERT INTO doctor_profiles (user_id, ${cols.join(", ")}) VALUES (?, ${placeHolders})`,
      [Number(userId), ...vals]
    );
  }
}

export async function getDoctorProfile(userId) {
  if (isMongoEnabled()) {
    return mongo.getDoctorProfile(userId);
  }
  const [rows] = await db.query("SELECT * FROM doctor_profiles WHERE user_id = ?", [Number(userId)]);
  return rows[0] || null;
}

export async function searchVerifiedDoctors(query = "all") {
  if (isMongoEnabled()) {
    return mongo.searchVerifiedDoctors(query);
  }
  if (!query || query === "all") {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, dp.specialty, dp.qualification, dp.experience_years, 
              dp.consultation_fee, dp.location, dp.bio, dp.available_days, dp.available_time_start, dp.available_time_end
       FROM users u
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE u.role = 'doctor' AND u.is_verified = 1 ORDER BY u.name ASC`
    );
    return rows;
  }
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, dp.specialty, dp.qualification, dp.experience_years, 
            dp.consultation_fee, dp.location, dp.bio, dp.available_days, dp.available_time_start, dp.available_time_end
     FROM users u
     LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
     WHERE u.role = 'doctor' AND u.is_verified = 1
       AND (u.name LIKE ? OR dp.specialty LIKE ? OR dp.location LIKE ? OR dp.qualification LIKE ? OR dp.bio LIKE ?)
     ORDER BY u.name ASC`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
  );
  return rows;
}

export async function searchPatients(query = "") {
  if (isMongoEnabled()) {
    return mongo.searchPatients(query);
  }
  if (!query || query.trim() === "") return [];
  const [rows] = await db.query(
    `SELECT id, name, email, phone, blood_group FROM users
     WHERE role='patient' AND (id = ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)`,
    [query, `%${query}%`, `%${query}%`, `%${query}%`]
  );
  return rows;
}
