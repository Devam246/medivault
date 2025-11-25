import db from "../config/db.js";


// -------------------------
// DASHBOARD OVERVIEW
// -------------------------
export async function getDoctorDashboard(req, res) {
  try {
    const doctorId = req.user.id;

    // Today’s appointments
    const [todayAppointments] = await db.query(
      `SELECT a.*, u.name AS patient_name
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id = ? 
       AND a.appointment_date = CURDATE()
       ORDER BY a.appointment_time ASC`,
      [doctorId]
    );

    // Total unique patients
    const [patientCount] = await db.query(
      `SELECT COUNT(DISTINCT patient_id) AS total
       FROM appointments WHERE doctor_id = ?`,
      [doctorId]
    );

    // Recent prescriptions
    const [recentPrescriptions] = await db.query(
      `SELECT p.*, u.name AS patient_name
       FROM prescriptions p
       JOIN users u ON p.patient_id = u.id
       WHERE p.doctor_id = ?
       ORDER BY p.prescribed_date DESC
       LIMIT 5`,
      [doctorId]
    );

    // Recent medical records doctor uploaded
    const [recentRecords] = await db.query(
      `SELECT mr.*, u.name AS patient_name
       FROM medical_records mr
       JOIN users u ON mr.patient_id = u.id
       WHERE mr.doctor_id = ?
       ORDER BY mr.record_date DESC
       LIMIT 5`,
      [doctorId]
    );

    return res.json({
      todayAppointments,
      totalPatients: patientCount[0].total,
      recentPrescriptions,
      recentRecords
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// -------------------------
// PATIENT SEARCH
// -------------------------
export async function searchPatient(req, res) {
  try {
    const { query } = req.query;

    const [patients] = await db.query(
      `SELECT id, name, email, phone, blood_group 
       FROM users 
       WHERE role='patient' AND 
       (id = ? )`,
      [query]
    );

    return res.json({ patients });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

// -----------------------------------------
// FULL MEDICAL HISTORY FOR DOCTOR VIEW
// -----------------------------------------
export async function getPatientHistory(req, res) {
  try {
    const patientId = req.params.id;

    const [profile] = await db.query(
      `SELECT id, name, email, phone, address, date_of_birth, blood_group, emergency_contact
       FROM users WHERE id = ? AND role='patient'`,
      [patientId]
    );

    if (profile.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const [vitals] = await db.query(
      `SELECT * FROM vital_signs 
       WHERE patient_id=? ORDER BY recorded_date DESC`,
      [patientId]
    );

    const [records] = await db.query(
      `SELECT * FROM medical_records 
       WHERE patient_id=? ORDER BY record_date DESC`,
      [patientId]
    );

    const [prescriptions] = await db.query(
      `SELECT p.*, d.name AS doctor_name
       FROM prescriptions p
       JOIN users d ON p.doctor_id = d.id
       WHERE patient_id=? ORDER BY prescribed_date DESC`,
      [patientId]
    );

    const [appointments] = await db.query(
      `SELECT a.*, d.name AS doctor_name
       FROM appointments a
       JOIN users d ON a.doctor_id = d.id
       WHERE patient_id=? ORDER BY appointment_date DESC`,
      [patientId]
    );

    return res.json({
      profile: profile[0],
      vitals,
      records,
      prescriptions,
      appointments,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}

