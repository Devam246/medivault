const express = require("express");
const router = express.Router();
const db = require("../db");  // your MySQL connection instance

router.post("/", (req, res) => {
  const { patient_name, date, time, reason } = req.body;

  if (!patient_name || !date || !time) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const sql = `
    INSERT INTO appointments (patient_name, date, time, reason)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [patient_name, date, time, reason], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json({
      message: "Appointment booked",
      appointment_id: result.insertId,
    });
  });
});

module.exports = router;
