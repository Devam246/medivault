import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function listMedicalRecords(patientId, limit = 0) {
  if (isMongoEnabled()) {
    return mongo.listMedicalRecords(patientId, limit);
  }
  let sql = `
    SELECT mr.*, u.name AS doctor_name 
    FROM medical_records mr
    LEFT JOIN users u ON mr.doctor_id = u.id
    WHERE mr.patient_id = ?
    ORDER BY mr.record_date DESC
  `;
  const params = [Number(patientId)];
  if (limit > 0) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }
  const [rows] = await db.query(sql, params);
  return rows;
}

export async function findMedicalRecordForPatient(recordId, patientId) {
  if (isMongoEnabled()) {
    return mongo.findMedicalRecordForPatient(recordId, patientId);
  }
  const [rows] = await db.query(
    "SELECT * FROM medical_records WHERE id = ? AND patient_id = ?",
    [Number(recordId), Number(patientId)]
  );
  return rows[0] || null;
}

export async function deleteMedicalRecord(recordId) {
  if (isMongoEnabled()) {
    return mongo.deleteMedicalRecord(recordId);
  }
  await db.query("DELETE FROM medical_records WHERE id = ?", [Number(recordId)]);
}

export async function createMedicalRecord(payload) {
  if (isMongoEnabled()) {
    return mongo.createMedicalRecord(payload);
  }
  const { patient_id, doctor_id, title, type, record_date, file_path, file_name, file_hash, transaction_hash, block_number, notes, uploaded_by } = payload;
  const [result] = await db.query(
    `INSERT INTO medical_records 
      (patient_id, doctor_id, title, type, record_date, file_path, file_name, file_hash, transaction_hash, block_number, notes, uploaded_by) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(patient_id),
      doctor_id ? Number(doctor_id) : null,
      title,
      type,
      record_date,
      file_path || null,
      file_name || null,
      file_hash || null,
      transaction_hash || null,
      block_number ? Number(block_number) : null,
      notes || null,
      uploaded_by,
    ]
  );
  return { id: result.insertId, ...payload };
}

export async function updateMedicalRecordBlockchain(recordId, transactionHash, blockNumber) {
  if (isMongoEnabled()) {
    const mongoDb = await (await import("../config/mongo.js")).getMongoDb();
    await mongoDb.collection("medical_records").updateOne(
      { id: Number(recordId) },
      { $set: { transaction_hash: transactionHash, block_number: Number(blockNumber) } }
    );
    return;
  }
  await db.query(
    "UPDATE medical_records SET transaction_hash = ?, block_number = ? WHERE id = ?",
    [transactionHash, Number(blockNumber), Number(recordId)]
  );
}

export async function listMedicalRecordsByDoctor(doctorId, limit = 5) {
  if (isMongoEnabled()) {
    const mongoDb = await (await import("../config/mongo.js")).getMongoDb();
    const list = await mongoDb.collection("medical_records")
      .find({ doctor_id: Number(doctorId) })
      .sort({ record_date: -1 })
      .limit(Number(limit))
      .toArray();

    // Fetch patient names
    const patientIds = [...new Set(list.map(r => Number(r.patient_id)))];
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
    `SELECT mr.*, u.name AS patient_name FROM medical_records mr 
     JOIN users u ON mr.patient_id = u.id 
     WHERE mr.doctor_id = ? ORDER BY mr.record_date DESC LIMIT ?`,
    [Number(doctorId), Number(limit)]
  );
  return rows;
}
