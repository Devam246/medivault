import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function listPrescriptions(patientId, limit = 0, activeOnly = false) {
  if (isMongoEnabled()) {
    return mongo.listPrescriptions(patientId, limit, activeOnly);
  }
  let sql = `
    SELECT p.*, u.name AS doctor_name 
    FROM prescriptions p
    JOIN users u ON p.doctor_id = u.id
    WHERE p.patient_id = ?
  `;
  const params = [Number(patientId)];
  if (activeOnly) {
    sql += " AND p.end_date >= CURDATE()";
  }
  sql += " ORDER BY p.prescribed_date DESC";
  if (limit > 0) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function listPrescriptionsForDoctorPatient(doctorId, patientId) {
  if (isMongoEnabled()) {
    return mongo.listPrescriptionsForDoctorPatient(doctorId, patientId);
  }
  const [rows] = await db.query(
    `SELECT p.*, d.name AS doctor_name 
     FROM prescriptions p
     JOIN users d ON p.doctor_id = d.id
     WHERE p.doctor_id = ? AND p.patient_id = ? 
     ORDER BY p.prescribed_date DESC`,
    [Number(doctorId), Number(patientId)]
  );
  return rows;
}

export async function createPrescription(payload) {
  if (isMongoEnabled()) {
    return mongo.createPrescription(payload);
  }
  const { patient_id, doctor_id, medicine_name, dosage, duration, instructions, prescribed_date, end_date } = payload;
  const [result] = await db.query(
    `INSERT INTO prescriptions 
      (patient_id, doctor_id, medicine_name, dosage, duration, instructions, prescribed_date, end_date) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(patient_id),
      Number(doctor_id),
      medicine_name,
      dosage,
      duration || null,
      instructions || null,
      prescribed_date,
      end_date || null,
    ]
  );
  const [rows] = await db.query(
    `SELECT p.*, u.name as doctor_name FROM prescriptions p
     JOIN users u ON p.doctor_id = u.id WHERE p.id = ?`,
    [result.insertId]
  );
  return rows[0];
}

export async function listPrescriptionsByDoctor(doctorId, limit = 5) {
  if (isMongoEnabled()) {
    const mongoDb = await (await import("../config/mongo.js")).getMongoDb();
    // Fetch patient name and join in memory for mongo, or just standard lookup
    const list = await mongoDb.collection("prescriptions")
      .find({ doctor_id: Number(doctorId) })
      .sort({ prescribed_date: -1 })
      .limit(Number(limit))
      .toArray();
    
    // Fetch patient names
    const patientIds = [...new Set(list.map(p => Number(p.patient_id)))];
    const patients = await mongoDb.collection("users")
      .find({ id: { $in: patientIds } })
      .toArray();
    const patientMap = new Map(patients.map(p => [p.id, p.name]));

    return list.map(item => ({
      ...item,
      patient_name: patientMap.get(Number(item.patient_id)) || "Unknown Patient",
    }));
  }
  const [rows] = await db.query(
    `SELECT p.*, u.name AS patient_name FROM prescriptions p 
     JOIN users u ON p.patient_id = u.id 
     WHERE p.doctor_id = ? ORDER BY p.prescribed_date DESC LIMIT ?`,
    [Number(doctorId), Number(limit)]
  );
  return rows;
}
