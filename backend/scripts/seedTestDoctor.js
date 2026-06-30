/**
 * Seed a verified doctor for local testing.
 * Run from repo root: node backend/scripts/seedTestDoctor.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const argon2 = (await import("argon2")).default;
const db = (await import("../config/db.js")).default;

const EMAIL = "abc123@gmail.com";
const PASSWORD = "1234";
const NAME = "Test Doctor (seed)";

async function main() {
  const password_hash = await argon2.hash(PASSWORD);

  const [existing] = await db.query("SELECT id, role FROM users WHERE email = ?", [EMAIL]);

  let userId;
  if (existing.length) {
    userId = existing[0].id;
    await db.query(
      `UPDATE users SET
        name = ?,
        password_hash = ?,
        role = 'doctor',
        reg_number = COALESCE(reg_number, 'TEST-REG-001'),
        degree = COALESCE(degree, 'MBBS'),
        is_verified = 1
      WHERE id = ?`,
      [NAME, password_hash, userId]
    );
    console.log(`Updated user id=${userId} to verified doctor.`);
  } else {
    const [ins] = await db.query(
      `INSERT INTO users
        (name, email, password_hash, role, reg_number, degree, document_path, is_verified)
       VALUES (?, ?, ?, 'doctor', 'TEST-REG-001', 'MBBS', NULL, 1)`,
      [NAME, EMAIL, password_hash]
    );
    userId = ins.insertId;
    console.log(`Inserted doctor user id=${userId}.`);
  }

  const [dpRows] = await db.query("SELECT id FROM doctor_profiles WHERE user_id = ?", [userId]);

  const profilePayload = [
    "General Practice",
    5,
    500.0,
    "MBBS",
    "Test City",
    "Mon,Tue,Wed,Thu,Fri",
    "09:00:00",
    "17:00:00",
    30,
    "Seed doctor account for testing only.",
    1,
    0,
  ];

  if (dpRows.length) {
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
      [...profilePayload, userId]
    );
    console.log("Updated doctor_profiles.");
  } else {
    await db.query(
      `INSERT INTO doctor_profiles
        (user_id, specialty, experience_years, consultation_fee, qualification, location,
         available_days, available_time_start, available_time_end, slot_duration, bio,
         accepts_new_patients, online_consultation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ...profilePayload]
    );
    console.log("Inserted doctor_profiles.");
  }

  console.log("\nLogin (choose Doctor on login page):");
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
