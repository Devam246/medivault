import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export async function createPrescription(req, res, next) {
  try {
    const doctorId = req.user.id;
    const { patientId, medicineName, dosage, duration, instructions, endDate } = req.body;

    if (!patientId || !medicineName || !dosage) {
      throw new AppError("patientId, medicineName and dosage are required", 400, "VALIDATION_ERROR");
    }

    const prescribedDate = new Date();
    const [result] = await db.query(
      `INSERT INTO prescriptions
        (patient_id, doctor_id, medicine_name, dosage, duration, instructions, prescribed_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, doctorId, medicineName, dosage, duration || null, instructions || null, prescribedDate, endDate || null]
    );

    const [rows] = await db.query(
      `SELECT p.*, u.name as doctor_name FROM prescriptions p
       JOIN users u ON p.doctor_id = u.id WHERE p.id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ message: "Prescription created", prescription: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function getPrescriptionsForPatientByDoctor(req, res, next) {
  try {
    const doctorId = req.user.id;
    const { patientId } = req.params;

    const [rows] = await db.query(
      `SELECT p.*, d.name as doctor_name FROM prescriptions p
       JOIN users d ON p.doctor_id = d.id
       WHERE p.doctor_id = ? AND p.patient_id = ? ORDER BY p.prescribed_date DESC`,
      [doctorId, patientId]
    );

    return res.json({ prescriptions: rows });
  } catch (err) {
    next(err);
  }
}
