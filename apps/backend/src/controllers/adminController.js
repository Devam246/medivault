import db from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export async function getDoctorList(req, res, next) {
  try {
    const status = req.query.status || "pending";
    if (status !== "pending") {
      throw new AppError("Only status=pending is supported", 400, "INVALID_STATUS");
    }
    const [doctors] = await db.query(
      `SELECT id, name, email, reg_number AS regNumber, degree, document_path AS documentPath
       FROM users WHERE role = 'doctor' AND is_verified = 0 ORDER BY name`
    );
    return res.json({ doctors });
  } catch (err) {
    next(err);
  }
}

export async function approveDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "UPDATE users SET is_verified = 1 WHERE id = ? AND role = 'doctor'",
      [id]
    );
    if (result.affectedRows === 0) {
      throw new AppError("Doctor not found", 404, "NOT_FOUND");
    }
    return res.json({ message: "Doctor approved successfully" });
  } catch (err) {
    next(err);
  }
}

export async function rejectDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      "DELETE FROM users WHERE id = ? AND role = 'doctor' AND is_verified = 0",
      [id]
    );
    if (result.affectedRows === 0) {
      throw new AppError("Doctor not found or already verified", 404, "NOT_FOUND");
    }
    return res.json({ message: "Doctor rejected successfully" });
  } catch (err) {
    next(err);
  }
}

export async function getSystemStats(req, res, next) {
  try {
    const [[users]] = await db.query("SELECT COUNT(*) AS count FROM users");
    const [[records]] = await db.query("SELECT COUNT(*) AS count FROM medical_records");
    const [[appointments]] = await db.query("SELECT COUNT(*) AS count FROM appointments");
    return res.json({
      users: users.count,
      records: records.count,
      appointments: appointments.count,
    });
  } catch (err) {
    next(err);
  }
}
