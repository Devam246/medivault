import db from "../config/db.js";
import crypto from "crypto";

// =======================
// DOCTOR AVAILABILITY MANAGEMENT
// =======================

// Get doctor's availability settings
export async function getDoctorAvailability(req, res) {
  try {
    const doctorId = req.user.id;
    
    const [rows] = await db.query(
      `SELECT * FROM doctor_profiles WHERE user_id = ?`,
      [doctorId]
    );

    if (rows.length === 0) {
      // Return default availability if profile doesn't exist
      const defaultAvailability = {
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false, start: '09:00', end: '13:00' },
        sunday: { enabled: false, start: '09:00', end: '13:00' }
      };
      return res.json({ availability: defaultAvailability });
    }

    const profile = rows[0];
    
    // Parse availability from database format to frontend format
    const availableDays = profile.available_days ? profile.available_days.split(',') : [];
    const dayMap = { 'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday', 
                     'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday' };
    
    const availability = {
      monday: { enabled: false, start: '09:00', end: '17:00' },
      tuesday: { enabled: false, start: '09:00', end: '17:00' },
      wednesday: { enabled: false, start: '09:00', end: '17:00' },
      thursday: { enabled: false, start: '09:00', end: '17:00' },
      friday: { enabled: false, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '13:00' },
      sunday: { enabled: false, start: '09:00', end: '13:00' }
    };
    
    // Set enabled days and times
    availableDays.forEach(shortDay => {
      const longDay = dayMap[shortDay];
      if (longDay) {
        availability[longDay].enabled = true;
        availability[longDay].start = profile.available_time_start?.substring(0, 5) || '09:00';
        availability[longDay].end = profile.available_time_end?.substring(0, 5) || '17:00';
      }
    });

    return res.json({ availability });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Update doctor's availability settings
export async function updateDoctorAvailability(req, res) {
  try {
    const doctorId = req.user.id;
    const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = req.body;

    // Convert availability object to database format
    const availableDays = [];
    const dayMap = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', 
                     friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    
    // Get the earliest start and latest end time
    let earliestStart = '23:59';
    let latestEnd = '00:00';
    
    Object.entries({ monday, tuesday, wednesday, thursday, friday, saturday, sunday }).forEach(([day, settings]) => {
      if (settings.enabled) {
        availableDays.push(dayMap[day]);
        if (settings.start < earliestStart) earliestStart = settings.start;
        if (settings.end > latestEnd) latestEnd = settings.end;
      }
    });

    // Update doctor profile
    await db.query(
      `UPDATE doctor_profiles 
       SET available_days = ?, 
           available_time_start = ?, 
           available_time_end = ?
       WHERE user_id = ?`,
      [availableDays.join(','), earliestStart, latestEnd, doctorId]
    );

    return res.json({ message: "Availability updated successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// =======================
// GET AVAILABLE SLOTS (FOR PATIENTS)
// =======================

export async function getAvailableSlots(req, res) {
  try {
    const doctorId = req.params.doctorId;
    const date = req.query.date; // YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ message: "Date parameter required" });
    }

    // Get doctor's availability settings
    const [profileRows] = await db.query(
      `SELECT available_days, available_time_start, available_time_end, slot_duration 
       FROM doctor_profiles WHERE user_id = ?`,
      [doctorId]
    );

    if (profileRows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const profile = profileRows[0];
    
    // Check if doctor is available on this day
    const dayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    const availableDays = profile.available_days ? profile.available_days.split(',') : [];
    
    if (!availableDays.includes(dayOfWeek)) {
      return res.json({ 
        message: "Doctor not available on this day",
        slots: [] 
      });
    }

    // Generate time slots
    const startTime = profile.available_time_start || '09:00:00';
    const endTime = profile.available_time_end || '17:00:00';
    const slotDuration = profile.slot_duration || 30; // minutes

    const slots = generateTimeSlots(startTime, endTime, slotDuration);

    // Get booked appointments for this date (CONFIRMED ONLY)
    const [bookedRows] = await db.query(
      `SELECT appointment_time 
       FROM appointments 
       WHERE doctor_id = ? 
       AND appointment_date = ? 
       AND status = 'confirmed'`,
      [doctorId, date]
    );

    const bookedTimes = new Set(bookedRows.map(r => r.appointment_time));

    // Mark slots as available or booked
    const availableSlots = slots.map(slot => ({
      time: slot,
      available: !bookedTimes.has(slot)
    }));

    return res.json({ 
      date, 
      slots: availableSlots 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, intervalMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes + intervalMinutes <= endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    slots.push(timeString);
    currentMinutes += intervalMinutes;
  }
  
  return slots;
}

// Helper function to generate access token
function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

// =======================
// BOOK APPOINTMENT (PATIENT)
// =======================

export async function bookAppointment(req, res) {
  const conn = await db.getConnection();
  
  try {
    const { doctor_id, appointment_date, appointment_time, reason } = req.body;
    const patient_id = req.user.id;

    if (!doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ 
        message: "Doctor ID, date, and time are required" 
      });
    }

    // Validate doctor exists and is verified
    const [doctorRows] = await db.query(
      `SELECT id FROM users WHERE id = ? AND role = 'doctor' AND is_verified = 1`,
      [doctor_id]
    );

    if (doctorRows.length === 0) {
      return res.status(404).json({ message: "Doctor not found or not verified" });
    }

    // Start transaction
    await conn.beginTransaction();

    // Check for existing CONFIRMED appointment (with lock)
    const [existingRows] = await conn.query(
      `SELECT id FROM appointments 
       WHERE doctor_id = ? 
       AND appointment_date = ? 
       AND appointment_time = ? 
       AND status = 'confirmed'
       FOR UPDATE`,
      [doctor_id, appointment_date, appointment_time]
    );

    if (existingRows.length > 0) {
      await conn.rollback();
      return res.status(409).json({ 
        message: "This time slot is already booked. Please select another time." 
      });
    }

    // Insert new appointment with 'pending' status
    const [result] = await conn.query(
      `INSERT INTO appointments 
       (patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_at) 
       VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [patient_id, doctor_id, appointment_date, appointment_time, reason || null]
    );

    const appointmentId = result.insertId;

    // Generate access token for medical history
    const accessToken = generateAccessToken();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6); // Token expires in 6 months

    await conn.query(
      `INSERT INTO patient_access_tokens 
       (patient_id, token, appointment_id, doctor_id, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [patient_id, accessToken, appointmentId, doctor_id, expiresAt]
    );

    await conn.commit();

    return res.json({ 
      message: "Appointment requested successfully! Waiting for doctor confirmation.",
      appointmentId,
      accessToken,
      tokenExpiry: expiresAt
    });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (conn) conn.release();
  }
}

// =======================
// GET PATIENT APPOINTMENTS
// =======================

export async function getPatientAppointments(req, res) {
  try {
    const patientId = req.user.id;

    const [appointments] = await db.query(
      `SELECT 
        a.*, 
        u.name AS doctor_name,
        dp.specialty,
        pat.token AS access_token,
        pat.expires_at AS token_expiry
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
       LEFT JOIN patient_access_tokens pat ON a.id = pat.appointment_id AND pat.is_active = TRUE
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [patientId]
    );

    return res.json({ appointments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// =======================
// CANCEL APPOINTMENT (PATIENT)
// =======================

export async function cancelAppointment(req, res) {
  try {
    const appointmentId = req.params.id;
    const patientId = req.user.id;

    // Verify appointment belongs to patient
    const [existingRows] = await db.query(
      `SELECT * FROM appointments WHERE id = ? AND patient_id = ?`,
      [appointmentId, patientId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ 
        message: "Appointment not found or you don't have permission to cancel it" 
      });
    }

    const appointment = existingRows[0];

    // Check if appointment is in the past
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
    if (appointmentDateTime < new Date()) {
      return res.status(400).json({ 
        message: "Cannot cancel past appointments" 
      });
    }

    // Update appointment status to cancelled
    await db.query(
      `UPDATE appointments SET status = 'cancelled' WHERE id = ?`,
      [appointmentId]
    );

    return res.json({ message: "Appointment cancelled successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// =======================
// GET DOCTOR APPOINTMENTS
// =======================

export async function getDoctorAppointments(req, res) {
  try {
    const doctorId = req.user.id;

    const [appointments] = await db.query(
      `SELECT 
        a.*, 
        u.name AS patient_name,
        u.email AS patient_email,
        u.phone AS patient_phone
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [doctorId]
    );

    return res.json({ appointments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// =======================
// RESPOND TO APPOINTMENT (DOCTOR)
// =======================

export async function respondToAppointment(req, res) {
  try {
    const appointmentId = req.params.id;
    const doctorId = req.user.id;
    const { action } = req.body; // 'approve' or 'decline'

    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use 'approve' or 'decline'" });
    }

    // Verify appointment belongs to doctor and is pending
    const [existingRows] = await db.query(
      `SELECT * FROM appointments WHERE id = ? AND doctor_id = ?`,
      [appointmentId, doctorId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ 
        message: "Appointment not found or you don't have permission" 
      });
    }

    const appointment = existingRows[0];

    if (appointment.status !== 'pending') {
      return res.status(400).json({ 
        message: `Appointment is already ${appointment.status}` 
      });
    }

    // Check if there's already a confirmed appointment at this time
    if (action === 'approve') {
      const [conflictRows] = await db.query(
        `SELECT id FROM appointments 
         WHERE doctor_id = ? 
         AND appointment_date = ? 
         AND appointment_time = ? 
         AND status = 'confirmed'
         AND id != ?`,
        [doctorId, appointment.appointment_date, appointment.appointment_time, appointmentId]
      );

      if (conflictRows.length > 0) {
        return res.status(409).json({ 
          message: "This time slot has already been confirmed for another patient" 
        });
      }
    }

    // Update appointment status
    const newStatus = action === 'approve' ? 'confirmed' : 'cancelled';
    
    await db.query(
      `UPDATE appointments SET status = ? WHERE id = ?`,
      [newStatus, appointmentId]
    );

    return res.json({ 
      message: `Appointment ${action === 'approve' ? 'approved' : 'declined'} successfully`,
      status: newStatus 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

// =======================
// ACCESS PATIENT HISTORY WITH TOKEN (DOCTOR)
// =======================

export async function getPatientHistoryWithToken(req, res) {
  try {
    const { token } = req.params;
    const doctorId = req.user.id;

    // Verify token
    const [tokenRows] = await db.query(
      `SELECT * FROM patient_access_tokens 
       WHERE token = ? 
       AND doctor_id = ? 
       AND is_active = TRUE 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [token, doctorId]
    );

    if (tokenRows.length === 0) {
      return res.status(403).json({ 
        message: "Invalid or expired token" 
      });
    }

    const tokenData = tokenRows[0];
    const patientId = tokenData.patient_id;

    // Update used_at timestamp
    await db.query(
      `UPDATE patient_access_tokens SET used_at = NOW() WHERE id = ?`,
      [tokenData.id]
    );

    // Fetch patient history
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
      tokenInfo: {
        appointmentId: tokenData.appointment_id,
        createdAt: tokenData.created_at,
        expiresAt: tokenData.expires_at
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
}