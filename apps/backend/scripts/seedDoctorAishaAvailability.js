import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const envPath = path.join(dir, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

async function main() {
  const doctorId = 8;
  const patientId = 1;
  const doctorEmail = 'doctor.aisha+medivault-demo@medivault.test';

  const [users] = await db.query('SELECT id, name, email, role FROM users WHERE id IN (?, ?) OR email = ?', [doctorId, patientId, doctorEmail]);
  console.log('Existing users:', users);

  const doctorExists = users.some(u => u.id === doctorId && u.role === 'doctor');
  if (!doctorExists) {
    console.log(`Doctor id=${doctorId} not found. Creating or updating user record for ${doctorEmail}.`);
    const [patientRows] = await db.query('SELECT id FROM users WHERE id = ? AND role = ?', [patientId, 'patient']);
    if (patientRows.length === 0) {
      console.warn(`Patient id=${patientId} not found. Please ensure patient 1 exists.`);
    }
    const [emailRows] = await db.query('SELECT id FROM users WHERE email = ?', [doctorEmail]);
    if (emailRows.length > 0) {
      await db.query('UPDATE users SET role = ?, name = ?, email = ?, is_verified = 1 WHERE id = ?', ['doctor', 'Dr. Aisha Mehta', doctorEmail, emailRows[0].id]);
      console.log(`Updated existing email user id=${emailRows[0].id} to doctor.`);
    } else {
      await db.query('INSERT INTO users (name, email, password_hash, role, reg_number, degree, document_path, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        'Dr. Aisha Mehta',
        doctorEmail,
        'DUMMY_HASH',
        'doctor',
        'MV-REG-1008',
        'MBBS, MD',
        null,
        1
      ]);
      console.log('Inserted doctor user record.');
    }
  }

  const [doctorProfileRows] = await db.query('SELECT id FROM doctor_profiles WHERE user_id = ?', [doctorId]);
  const availability = {
    available_days: 'Mon,Tue,Wed,Thu,Fri',
    available_time_start: '09:00:00',
    available_time_end: '17:00:00',
    slot_duration: 30,
    specialty: 'Internal Medicine',
    experience_years: 7,
    consultation_fee: 600.0,
    qualification: 'MBBS, MD',
    location: 'Pune',
    bio: 'Focus on preventive care, diabetes, and lifestyle management.',
    accepts_new_patients: 1,
    online_consultation: 1
  };

  if (doctorProfileRows.length > 0) {
    await db.query(
      `UPDATE doctor_profiles SET
        specialty = ?,
        experience_years = ?,
        consultation_fee = ?,
        qualification = ?,
        location = ?,
        available_days = ?,
        available_time_start = ?,
        available_time_end = ?,
        slot_duration = ?,
        bio = ?,
        accepts_new_patients = ?,
        online_consultation = ?
       WHERE user_id = ?`,
      [
        availability.specialty,
        availability.experience_years,
        availability.consultation_fee,
        availability.qualification,
        availability.location,
        availability.available_days,
        availability.available_time_start,
        availability.available_time_end,
        availability.slot_duration,
        availability.bio,
        availability.accepts_new_patients,
        availability.online_consultation,
        doctorId
      ]
    );
    console.log('Updated doctor_profiles for doctor id=' + doctorId);
  } else {
    await db.query(
      `INSERT INTO doctor_profiles
        (user_id, specialty, experience_years, consultation_fee, qualification, location,
         available_days, available_time_start, available_time_end, slot_duration, bio,
         accepts_new_patients, online_consultation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doctorId,
        availability.specialty,
        availability.experience_years,
        availability.consultation_fee,
        availability.qualification,
        availability.location,
        availability.available_days,
        availability.available_time_start,
        availability.available_time_end,
        availability.slot_duration,
        availability.bio,
        availability.accepts_new_patients,
        availability.online_consultation
      ]
    );
    console.log('Inserted doctor_profiles for doctor id=' + doctorId);
  }

  console.log('Seeding complete.');
  await db.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
