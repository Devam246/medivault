/**
 * Seed a small, realistic demo dataset for presentations.
 *
 * - Creates verified doctors + patients (with profile fields)
 * - Creates doctor_profiles
 * - Seeds appointments (today + upcoming + past), prescriptions, vitals, records
 * - Seeds a patient_access_tokens row for a confirmed appointment (if table/columns exist)
 * - Prints IDs + login credentials and writes them to backend/scripts/seed-output.json
 *
 * Run from repo root:
 *   node backend/scripts/seedDemoData.js
 *
 * Or via npm script (added in package.json):
 *   npm run seed:demo
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const argon2 = (await import("argon2")).default;
const db = (await import("../config/db.js")).default;

const SEED_TAG = process.env.DEMO_SEED_TAG || "medivault-demo";
const PASSWORD = process.env.DEMO_SEED_PASSWORD || "Demo1234!";

function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function timeHHMMSS(h, m = 0) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

async function getTableColumns(tableName) {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME AS name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );
  return new Set(rows.map((r) => String(r.name)));
}

function pickInsert(table, payload, columns) {
  const entries = Object.entries(payload).filter(([k]) => columns.has(k));
  if (!entries.length) {
    throw new Error(`No matching columns for table ${table}`);
  }
  const cols = entries.map(([k]) => k);
  const vals = entries.map(([, v]) => v);
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
  return { sql, vals };
}

async function upsertUserByEmail({
  name,
  email,
  role,
  is_verified,
  reg_number,
  degree,
  document_path,
  date_of_birth,
  blood_group,
  phone,
  address,
  emergency_contact,
}) {
  const password_hash = await argon2.hash(PASSWORD);
  const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);

  if (existing.length) {
    const id = existing[0].id;
    await db.query(
      `UPDATE users SET
        name = ?,
        password_hash = ?,
        role = ?,
        is_verified = ?,
        reg_number = ?,
        degree = ?,
        document_path = ?,
        date_of_birth = ?,
        blood_group = ?,
        phone = ?,
        address = ?,
        emergency_contact = ?
       WHERE id = ?`,
      [
        name,
        password_hash,
        role,
        is_verified,
        reg_number || null,
        degree || null,
        document_path || null,
        date_of_birth || null,
        blood_group || null,
        phone || null,
        address || null,
        emergency_contact || null,
        id,
      ]
    );
    return { id, email };
  }

  const [ins] = await db.query(
    `INSERT INTO users
      (name, email, password_hash, role, is_verified, reg_number, degree, document_path,
       date_of_birth, blood_group, phone, address, emergency_contact)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      password_hash,
      role,
      is_verified,
      reg_number || null,
      degree || null,
      document_path || null,
      date_of_birth || null,
      blood_group || null,
      phone || null,
      address || null,
      emergency_contact || null,
    ]
  );
  return { id: ins.insertId, email };
}

async function upsertDoctorProfile(userId, profile) {
  const [existing] = await db.query("SELECT id FROM doctor_profiles WHERE user_id = ?", [userId]);

  const payload = {
    user_id: userId,
    specialty: profile.specialty,
    experience_years: profile.experience_years,
    consultation_fee: profile.consultation_fee,
    qualification: profile.qualification,
    location: profile.location,
    available_days: profile.available_days,
    available_time_start: profile.available_time_start,
    available_time_end: profile.available_time_end,
    slot_duration: profile.slot_duration,
    bio: profile.bio,
    accepts_new_patients: profile.accepts_new_patients,
    online_consultation: profile.online_consultation,
  };

  if (existing.length) {
    const dpId = existing[0].id;
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
        payload.specialty,
        payload.experience_years,
        payload.consultation_fee,
        payload.qualification,
        payload.location,
        payload.available_days,
        payload.available_time_start,
        payload.available_time_end,
        payload.slot_duration,
        payload.bio,
        payload.accepts_new_patients,
        payload.online_consultation,
        userId,
      ]
    );
    return dpId;
  }

  const [ins] = await db.query(
    `INSERT INTO doctor_profiles
      (user_id, specialty, experience_years, consultation_fee, qualification, location,
       available_days, available_time_start, available_time_end, slot_duration, bio,
       accepts_new_patients, online_consultation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id,
      payload.specialty,
      payload.experience_years,
      payload.consultation_fee,
      payload.qualification,
      payload.location,
      payload.available_days,
      payload.available_time_start,
      payload.available_time_end,
      payload.slot_duration,
      payload.bio,
      payload.accepts_new_patients,
      payload.online_consultation,
    ]
  );
  return ins.insertId;
}

async function cleanupForUsers({ doctorIds, patientIds }) {
  const allPatientIds = patientIds?.length ? patientIds : [];
  const allDoctorIds = doctorIds?.length ? doctorIds : [];

  // Best-effort cleanup. Some tables might not exist depending on local schema.
  const maybeTables = [
    { name: "patient_access_tokens", where: "patient_id IN (?) OR doctor_id IN (?)" },
    { name: "appointments", where: "patient_id IN (?) OR doctor_id IN (?)" },
    { name: "prescriptions", where: "patient_id IN (?) OR doctor_id IN (?)" },
    { name: "medical_records", where: "patient_id IN (?) OR doctor_id IN (?)" },
    { name: "vital_signs", where: "patient_id IN (?)" },
  ];

  for (const t of maybeTables) {
    try {
      await db.query(`DELETE FROM ${t.name} WHERE ${t.where}`, [
        allPatientIds,
        allDoctorIds,
      ]);
    } catch {
      // ignore (table may not exist / column may not exist)
    }
  }
}

async function main() {
  const doctors = [
    {
      name: "Dr. Aisha Mehta",
      email: `doctor.aisha+${SEED_TAG}@medivault.test`,
      reg_number: "MV-REG-1001",
      degree: "MBBS, MD (Internal Medicine)",
      profile: {
        specialty: "Internal Medicine",
        experience_years: 7,
        consultation_fee: 600.0,
        qualification: "MBBS, MD",
        location: "Pune",
        available_days: "Mon,Tue,Wed,Thu,Fri",
        available_time_start: "09:00:00",
        available_time_end: "17:00:00",
        slot_duration: 30,
        bio: "Focus on preventive care, diabetes, and lifestyle management.",
        accepts_new_patients: 1,
        online_consultation: 1,
      },
    },
    {
      name: "Dr. Rohan Sharma",
      email: `doctor.rohan+${SEED_TAG}@medivault.test`,
      reg_number: "MV-REG-1002",
      degree: "MBBS, MS (Orthopedics)",
      profile: {
        specialty: "Orthopedics",
        experience_years: 10,
        consultation_fee: 800.0,
        qualification: "MBBS, MS",
        location: "Mumbai",
        available_days: "Mon,Wed,Fri",
        available_time_start: "10:00:00",
        available_time_end: "16:00:00",
        slot_duration: 30,
        bio: "Sports injuries, joint pain, and post-op rehab plans.",
        accepts_new_patients: 1,
        online_consultation: 0,
      },
    },
  ];

  const patients = [
    {
      name: "Aryan Patel",
      email: `patient.aryan+${SEED_TAG}@medivault.test`,
      date_of_birth: "2003-09-14",
      blood_group: "B+",
      phone: "9876543210",
      address: "Koregaon Park, Pune",
      emergency_contact: "Riya Patel",
    },
    {
      name: "Neha Verma",
      email: `patient.neha+${SEED_TAG}@medivault.test`,
      date_of_birth: "1998-02-07",
      blood_group: "O+",
      phone: "9898989898",
      address: "Andheri West, Mumbai",
      emergency_contact: "Amit Verma",
    },
    {
      name: "Kabir Singh",
      email: `patient.kabir+${SEED_TAG}@medivault.test`,
      date_of_birth: "1995-11-23",
      blood_group: "A-",
      phone: "9000011111",
      address: "Baner, Pune",
      emergency_contact: "Simran Singh",
    },
  ];

  // Create/Update users
  const createdDoctors = [];
  for (const d of doctors) {
    const u = await upsertUserByEmail({
      name: d.name,
      email: d.email,
      role: "doctor",
      is_verified: 1,
      reg_number: d.reg_number,
      degree: d.degree,
    });
    await upsertDoctorProfile(u.id, d.profile);
    createdDoctors.push({ ...u, name: d.name });
  }

  const createdPatients = [];
  for (const p of patients) {
    const u = await upsertUserByEmail({
      name: p.name,
      email: p.email,
      role: "patient",
      is_verified: 1,
      date_of_birth: p.date_of_birth,
      blood_group: p.blood_group,
      phone: p.phone,
      address: p.address,
      emergency_contact: p.emergency_contact,
    });
    createdPatients.push({ ...u, name: p.name });
  }

  // Clear prior demo rows for these users (so reruns don't clutter the UI)
  await cleanupForUsers({
    doctorIds: createdDoctors.map((d) => d.id),
    patientIds: createdPatients.map((p) => p.id),
  });

  const colsAppointments = await getTableColumns("appointments").catch(() => new Set());
  const colsPrescriptions = await getTableColumns("prescriptions").catch(() => new Set());
  const colsVitals = await getTableColumns("vital_signs").catch(() => new Set());
  const colsRecords = await getTableColumns("medical_records").catch(() => new Set());
  const colsTokens = await getTableColumns("patient_access_tokens").catch(() => new Set());

  const doctor1 = createdDoctors[0];
  const doctor2 = createdDoctors[1];
  const patient1 = createdPatients[0];
  const patient2 = createdPatients[1];
  const patient3 = createdPatients[2];

  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  // Appointments (include at least one "today" for doctor dashboard)
  const apptPayloads = [
    {
      patient_id: patient1.id,
      doctor_id: doctor1.id,
      appointment_date: ymd(today),
      appointment_time: timeHHMMSS(11, 0),
      reason: `[${SEED_TAG}] Follow-up: BP + glucose review`,
      status: "confirmed",
      created_at: new Date(),
    },
    {
      patient_id: patient2.id,
      doctor_id: doctor1.id,
      appointment_date: ymd(tomorrow),
      appointment_time: timeHHMMSS(15, 0),
      reason: `[${SEED_TAG}] Headache & fatigue`,
      status: "pending",
      created_at: new Date(),
    },
    {
      patient_id: patient3.id,
      doctor_id: doctor2.id,
      appointment_date: ymd(nextWeek),
      appointment_time: timeHHMMSS(12, 30),
      reason: `[${SEED_TAG}] Knee pain after running`,
      status: "confirmed",
      created_at: new Date(),
    },
    {
      patient_id: patient1.id,
      doctor_id: doctor2.id,
      appointment_date: ymd(twoDaysAgo),
      appointment_time: timeHHMMSS(10, 0),
      reason: `[${SEED_TAG}] Shoulder stiffness`,
      status: "confirmed",
      created_at: new Date(twoDaysAgo),
    },
  ];

  const appointmentIds = [];
  for (const a of apptPayloads) {
    if (!colsAppointments.size) break;
    const payload = { ...a };
    if (!colsAppointments.has("created_at")) delete payload.created_at;
    const { sql, vals } = pickInsert("appointments", payload, colsAppointments);
    const [ins] = await db.query(sql, vals);
    appointmentIds.push(ins.insertId);
  }

  // Create token for the first appointment (so patient UI shows access token)
  if (colsTokens.size && appointmentIds.length) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const tokenPayload = {
      patient_id: patient1.id,
      token,
      appointment_id: appointmentIds[0],
      doctor_id: doctor1.id,
      expires_at: expiresAt,
      is_active: true,
      created_at: new Date(),
      used_at: null,
    };

    // Deactivate any existing active grants for this patient+doctor (if those cols exist)
    try {
      if (colsTokens.has("is_active") && colsTokens.has("patient_id") && colsTokens.has("doctor_id")) {
        await db.query(
          `UPDATE patient_access_tokens
           SET is_active = FALSE
           WHERE patient_id = ?
             AND doctor_id = ?
             AND is_active = TRUE`,
          [patient1.id, doctor1.id]
        );
      }
    } catch {
      // ignore
    }

    const { sql, vals } = pickInsert("patient_access_tokens", tokenPayload, colsTokens);
    try {
      await db.query(sql, vals);
    } catch {
      // ignore
    }
  }

  // Prescriptions (ensure some are active: end_date >= today)
  const rxPayloads = [
    {
      patient_id: patient1.id,
      doctor_id: doctor1.id,
      medicine_name: "Metformin",
      dosage: "500 mg twice daily",
      duration: "30 days",
      instructions: "After meals. Maintain hydration.",
      prescribed_date: today,
      end_date: ymd(nextWeek),
    },
    {
      patient_id: patient2.id,
      doctor_id: doctor1.id,
      medicine_name: "Vitamin D3",
      dosage: "60,000 IU weekly",
      duration: "8 weeks",
      instructions: "Take after lunch.",
      prescribed_date: twoDaysAgo,
      end_date: ymd(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    },
    {
      patient_id: patient3.id,
      doctor_id: doctor2.id,
      medicine_name: "Ibuprofen",
      dosage: "400 mg as needed",
      duration: "5 days",
      instructions: "Do not exceed 3 doses/day. Take with food.",
      prescribed_date: today,
      end_date: ymd(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
    },
  ];

  for (const rx of rxPayloads) {
    if (!colsPrescriptions.size) break;
    const { sql, vals } = pickInsert("prescriptions", rx, colsPrescriptions);
    try {
      await db.query(sql, vals);
    } catch {
      // ignore
    }
  }

  // Vitals
  const vitalsPayloads = [
    {
      patient_id: patient1.id,
      blood_pressure: "128/84",
      heart_rate: 78,
      temperature: 98.6,
      weight: 72.4,
      recorded_date: today,
      notes: `[${SEED_TAG}] Morning reading`,
    },
    {
      patient_id: patient2.id,
      blood_pressure: "118/76",
      heart_rate: 72,
      temperature: 98.4,
      weight: 60.1,
      recorded_date: twoDaysAgo,
      notes: `[${SEED_TAG}] Routine check`,
    },
    {
      patient_id: patient3.id,
      blood_pressure: "122/80",
      heart_rate: 75,
      temperature: 98.7,
      weight: 80.0,
      recorded_date: today,
      notes: `[${SEED_TAG}] Post-workout`,
    },
  ];

  for (const v of vitalsPayloads) {
    if (!colsVitals.size) break;
    const { sql, vals } = pickInsert("vital_signs", v, colsVitals);
    try {
      await db.query(sql, vals);
    } catch {
      // ignore
    }
  }

  // Medical records (no file attached; still useful for UX lists)
  const recordPayloads = [
    {
      patient_id: patient1.id,
      doctor_id: doctor1.id,
      title: "Blood Sugar Panel",
      type: "Lab Report",
      record_date: ymd(twoDaysAgo),
      file_path: null,
      file_name: null,
      notes: `[${SEED_TAG}] HbA1c slightly elevated.`,
      uploaded_by: "doctor",
    },
    {
      patient_id: patient2.id,
      doctor_id: doctor1.id,
      title: "General Consultation Note",
      type: "Consultation",
      record_date: ymd(today),
      file_path: null,
      file_name: null,
      notes: `[${SEED_TAG}] Lifestyle advice + hydration.`,
      uploaded_by: "doctor",
    },
    {
      patient_id: patient3.id,
      doctor_id: doctor2.id,
      title: "Knee X-Ray Summary",
      type: "Imaging",
      record_date: ymd(today),
      file_path: null,
      file_name: null,
      notes: `[${SEED_TAG}] No fracture; rest and physio recommended.`,
      uploaded_by: "doctor",
    },
  ];

  for (const r of recordPayloads) {
    if (!colsRecords.size) break;
    const payload = { ...r };
    // If schema doesn't have doctor_id / file_name, pickInsert will drop them.
    const { sql, vals } = pickInsert("medical_records", payload, colsRecords);
    try {
      await db.query(sql, vals);
    } catch {
      // ignore
    }
  }

  const output = {
    seedTag: SEED_TAG,
    password: PASSWORD,
    doctors: createdDoctors.map((d) => ({ id: d.id, name: d.name, email: d.email })),
    patients: createdPatients.map((p) => ({ id: p.id, name: p.name, email: p.email })),
  };

  const outPath = path.join(__dirname, "seed-output.json");
  await fs.writeFile(outPath, JSON.stringify(output, null, 2), "utf-8");

  console.log("\n=== MediVault Demo Seed Complete ===");
  console.log(`Seed tag: ${SEED_TAG}`);
  console.log(`Password for all demo accounts: ${PASSWORD}\n`);

  console.log("Doctors:");
  for (const d of output.doctors) {
    console.log(`- id=${d.id}  ${d.name}  <${d.email}>`);
  }
  console.log("\nPatients:");
  for (const p of output.patients) {
    console.log(`- id=${p.id}  ${p.name}  <${p.email}>`);
  }

  console.log(`\nSaved: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});

