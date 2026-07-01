/**
 * Seed demo accounts for MediVault.
 *
 * Creates 1 admin, 4 verified doctors with profiles, and 4 verified patients.
 * Run from repo root: npm run seed:demo
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import argon2 from "argon2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { isMongoEnabled, getMongoDb, ensureMongoIndexes, closeMongo } = await import("../src/config/mongo.js");

const SEED_TAG = process.env.DEMO_SEED_TAG || "medivault-demo";
const PASSWORD = process.env.DEMO_SEED_PASSWORD || "Demo1234!";

const admins = [
  { name: "MediVault Admin", email: "admin+" + SEED_TAG + "@medivault.test", phone: "9000000001" }
];

const doctors = [
  {
    name: "Dr. Aisha Mehta",
    email: "doctor.aisha+" + SEED_TAG + "@medivault.test",
    phone: "9000000101",
    reg_number: "MV-REG-1001",
    degree: "MBBS, MD (Internal Medicine)",
    profile: { specialty: "Internal Medicine", experience_years: 7, consultation_fee: 600, qualification: "MBBS, MD", location: "Pune", available_days: "Mon,Tue,Wed,Thu,Fri", available_time_start: "09:00:00", available_time_end: "17:00:00", slot_duration: 30, bio: "Preventive care, diabetes, and lifestyle management.", accepts_new_patients: 1, online_consultation: 1 }
  },
  {
    name: "Dr. Rohan Sharma",
    email: "doctor.rohan+" + SEED_TAG + "@medivault.test",
    phone: "9000000102",
    reg_number: "MV-REG-1002",
    degree: "MBBS, MS (Orthopedics)",
    profile: { specialty: "Orthopedics", experience_years: 10, consultation_fee: 800, qualification: "MBBS, MS", location: "Mumbai", available_days: "Mon,Wed,Fri", available_time_start: "10:00:00", available_time_end: "16:00:00", slot_duration: 30, bio: "Sports injuries, joint pain, and rehabilitation plans.", accepts_new_patients: 1, online_consultation: 0 }
  },
  {
    name: "Dr. Sara Khan",
    email: "doctor.sara+" + SEED_TAG + "@medivault.test",
    phone: "9000000103",
    reg_number: "MV-REG-1003",
    degree: "MBBS, MD (Dermatology)",
    profile: { specialty: "Dermatology", experience_years: 6, consultation_fee: 700, qualification: "MBBS, MD", location: "Delhi", available_days: "Tue,Thu,Sat", available_time_start: "11:00:00", available_time_end: "18:00:00", slot_duration: 30, bio: "Skin allergies, acne care, and long-term treatment plans.", accepts_new_patients: 1, online_consultation: 1 }
  },
  {
    name: "Dr. Vikram Nair",
    email: "doctor.vikram+" + SEED_TAG + "@medivault.test",
    phone: "9000000104",
    reg_number: "MV-REG-1004",
    degree: "MBBS, MD, DM (Cardiology)",
    profile: { specialty: "Cardiology", experience_years: 12, consultation_fee: 1000, qualification: "MBBS, MD, DM", location: "Bengaluru", available_days: "Mon,Tue,Thu,Fri", available_time_start: "08:30:00", available_time_end: "14:30:00", slot_duration: 30, bio: "Heart health, hypertension, and preventive cardiology.", accepts_new_patients: 1, online_consultation: 1 }
  }
];

const patients = [
  { name: "Aryan Patel", email: "patient.aryan+" + SEED_TAG + "@medivault.test", phone: "9000000201", date_of_birth: "2003-09-14", blood_group: "B+", address: "Koregaon Park, Pune", emergency_contact: "Riya Patel - 9000000301" },
  { name: "Neha Verma", email: "patient.neha+" + SEED_TAG + "@medivault.test", phone: "9000000202", date_of_birth: "1998-02-07", blood_group: "O+", address: "Andheri West, Mumbai", emergency_contact: "Amit Verma - 9000000302" },
  { name: "Kabir Singh", email: "patient.kabir+" + SEED_TAG + "@medivault.test", phone: "9000000203", date_of_birth: "1995-11-23", blood_group: "A-", address: "Baner, Pune", emergency_contact: "Simran Singh - 9000000303" },
  { name: "Meera Iyer", email: "patient.meera+" + SEED_TAG + "@medivault.test", phone: "9000000204", date_of_birth: "2000-05-19", blood_group: "AB+", address: "Indiranagar, Bengaluru", emergency_contact: "Ravi Iyer - 9000000304" }
];

function userPayload(person, role, passwordHash) {
  return {
    name: person.name,
    email: person.email,
    password_hash: passwordHash,
    role: role,
    is_verified: 1,
    reg_number: person.reg_number || null,
    degree: person.degree || null,
    document_path: null,
    date_of_birth: person.date_of_birth || null,
    blood_group: person.blood_group || null,
    phone: person.phone || null,
    address: person.address || null,
    emergency_contact: person.emergency_contact || null
  };
}

async function seedMysql(passwordHash) {
  const db = (await import("../src/config/db.js")).default;

  async function upsertUser(person, role) {
    const payload = userPayload(person, role, passwordHash);
    const existing = await db.query("SELECT id FROM users WHERE email = ?", [payload.email]);
    const rows = existing[0];

    if (rows.length) {
      const id = rows[0].id;
      await db.query("UPDATE users SET name=?, password_hash=?, role=?, is_verified=?, reg_number=?, degree=?, document_path=?, date_of_birth=?, blood_group=?, phone=?, address=?, emergency_contact=? WHERE id=?", [payload.name, payload.password_hash, payload.role, payload.is_verified, payload.reg_number, payload.degree, payload.document_path, payload.date_of_birth, payload.blood_group, payload.phone, payload.address, payload.emergency_contact, id]);
      return { id: id, name: payload.name, email: payload.email, role: role };
    }

    const inserted = await db.query("INSERT INTO users (name, email, password_hash, role, is_verified, reg_number, degree, document_path, date_of_birth, blood_group, phone, address, emergency_contact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [payload.name, payload.email, payload.password_hash, payload.role, payload.is_verified, payload.reg_number, payload.degree, payload.document_path, payload.date_of_birth, payload.blood_group, payload.phone, payload.address, payload.emergency_contact]);
    return { id: inserted[0].insertId, name: payload.name, email: payload.email, role: role };
  }

  async function upsertDoctorProfile(userId, profile) {
    const existing = await db.query("SELECT id FROM doctor_profiles WHERE user_id = ?", [userId]);
    const values = [profile.specialty, profile.experience_years, profile.consultation_fee, profile.qualification, profile.location, profile.available_days, profile.available_time_start, profile.available_time_end, profile.slot_duration, profile.bio, profile.accepts_new_patients, profile.online_consultation];
    if (existing[0].length) {
      await db.query("UPDATE doctor_profiles SET specialty=?, experience_years=?, consultation_fee=?, qualification=?, location=?, available_days=?, available_time_start=?, available_time_end=?, slot_duration=?, bio=?, accepts_new_patients=?, online_consultation=? WHERE user_id=?", values.concat([userId]));
    } else {
      await db.query("INSERT INTO doctor_profiles (user_id, specialty, experience_years, consultation_fee, qualification, location, available_days, available_time_start, available_time_end, slot_duration, bio, accepts_new_patients, online_consultation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [userId].concat(values));
    }
  }

  const createdAdmins = [];
  const createdDoctors = [];
  const createdPatients = [];

  for (const admin of admins) createdAdmins.push(await upsertUser(admin, "admin"));
  for (const doctor of doctors) {
    const created = await upsertUser(doctor, "doctor");
    await upsertDoctorProfile(created.id, doctor.profile);
    createdDoctors.push(created);
  }
  for (const patient of patients) createdPatients.push(await upsertUser(patient, "patient"));

  await db.end();
  return { admins: createdAdmins, doctors: createdDoctors, patients: createdPatients };
}

async function seedMongo(passwordHash) {
  await ensureMongoIndexes();
  const db = await getMongoDb();

  async function nextSequence(name) {
    const result = await db.collection("counters").findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
    return result.seq;
  }

  async function upsertUser(person, role) {
    const payload = userPayload(person, role, passwordHash);
    payload.updated_at = new Date();
    const existing = await db.collection("users").findOne({ email: payload.email });

    if (existing) {
      await db.collection("users").updateOne({ email: payload.email }, { $set: payload });
      return { id: existing.id, name: payload.name, email: payload.email, role: role };
    }

    const user = Object.assign({ id: await nextSequence("users"), created_at: new Date() }, payload);
    await db.collection("users").insertOne(user);
    return { id: user.id, name: user.name, email: user.email, role: role };
  }

  async function upsertDoctorProfile(userId, profile) {
    await db.collection("doctor_profiles").updateOne(
      { user_id: Number(userId) },
      { $set: Object.assign({}, profile, { user_id: Number(userId), updated_at: new Date() }), $setOnInsert: { id: await nextSequence("doctor_profiles"), created_at: new Date() } },
      { upsert: true }
    );
  }

  const createdAdmins = [];
  const createdDoctors = [];
  const createdPatients = [];

  for (const admin of admins) createdAdmins.push(await upsertUser(admin, "admin"));
  for (const doctor of doctors) {
    const created = await upsertUser(doctor, "doctor");
    await upsertDoctorProfile(created.id, doctor.profile);
    createdDoctors.push(created);
  }
  for (const patient of patients) createdPatients.push(await upsertUser(patient, "patient"));

  await closeMongo();
  return { admins: createdAdmins, doctors: createdDoctors, patients: createdPatients };
}

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);
  const result = isMongoEnabled() ? await seedMongo(passwordHash) : await seedMysql(passwordHash);
  const output = Object.assign({ dataStore: isMongoEnabled() ? "mongo" : "mysql", seedTag: SEED_TAG, password: PASSWORD }, result);
  const outputPath = path.join(__dirname, "seed-output.json");
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log("\n=== MediVault Demo Accounts Seeded ===");
  console.log("Password for every demo account: " + PASSWORD + "\n");
  for (const section of ["admins", "doctors", "patients"]) {
    console.log(section.toUpperCase());
    for (const account of output[section]) console.log("- " + account.name + " | " + account.email);
    console.log("");
  }
  console.log("Saved details to: " + outputPath);
}

main().catch(async (err) => {
  console.error("\nSeed failed:", err);
  await closeMongo().catch(() => {});
  process.exitCode = 1;
});
