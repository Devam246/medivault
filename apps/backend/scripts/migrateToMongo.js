/**
 * scripts/migrateToMongo.js — Standalone script to migrate MySQL tables into MongoDB.
 *
 * It reads all rows from MySQL, maps them to document formats, handles type
 * conversions, and performs idempotent upserts into MongoDB.
 * It also initializes sequence counters in MongoDB to prevent ID collisions.
 *
 * Run from repo root:
 *   npm run migrate:mongo
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import db from "../src/config/db.js";
import { getMongoDb, ensureMongoIndexes } from "../src/config/mongo.js";
import { tokenLookupHash } from "../src/repositories/mongoRepository.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function queryTable(tableName) {
  try {
    const [rows] = await db.query(`SELECT * FROM ${tableName}`);
    return rows;
  } catch (err) {
    console.warn(`⚠️ Table "${tableName}" could not be read (might not exist):`, err.message);
    return null;
  }
}

async function runMigration() {
  console.log("🚀 Starting database migration from MySQL to MongoDB...");

  let mongoDb;
  try {
    mongoDb = await getMongoDb();
    console.log("✅ MongoDB Connected successfully");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  }

  console.log("📦 Ensuring MongoDB collections and indexes exist...");
  await ensureMongoIndexes();
  console.log("✅ MongoDB collections and indexes verified");

  // Helper mappings
  const cleanUser = (row) => ({
    id: Number(row.id),
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    is_verified: Number(row.is_verified),
    reg_number: row.reg_number || null,
    degree: row.degree || null,
    document_path: row.document_path || null,
    date_of_birth: row.date_of_birth ? new Date(row.date_of_birth).toISOString().slice(0, 10) : null,
    blood_group: row.blood_group || null,
    phone: row.phone || null,
    address: row.address || null,
    emergency_contact: row.emergency_contact || null,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  const cleanDoctorProfile = (row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    specialty: row.specialty || null,
    experience_years: row.experience_years !== null ? Number(row.experience_years) : null,
    consultation_fee: row.consultation_fee !== null ? Number(row.consultation_fee) : null,
    qualification: row.qualification || null,
    location: row.location || null,
    available_days: row.available_days || null,
    available_time_start: row.available_time_start || null,
    available_time_end: row.available_time_end || null,
    slot_duration: row.slot_duration !== null ? Number(row.slot_duration) : 30,
    bio: row.bio || null,
    accepts_new_patients: row.accepts_new_patients === null ? true : !!row.accepts_new_patients,
    online_consultation: row.online_consultation === null ? false : !!row.online_consultation,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  const cleanAppointment = (row) => ({
    id: Number(row.id),
    patient_id: Number(row.patient_id),
    doctor_id: Number(row.doctor_id),
    appointment_date: row.appointment_date ? new Date(row.appointment_date).toISOString().slice(0, 10) : null,
    appointment_time: row.appointment_time || null,
    reason: row.reason || null,
    status: row.status || "pending",
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  const cleanMedicalRecord = (row) => ({
    id: Number(row.id),
    patient_id: Number(row.patient_id),
    doctor_id: row.doctor_id !== null ? Number(row.doctor_id) : null,
    title: row.title,
    type: row.type,
    record_date: row.record_date ? new Date(row.record_date).toISOString().slice(0, 10) : null,
    file_path: row.file_path || null,
    file_name: row.file_name || null,
    file_hash: row.file_hash || null,
    transaction_hash: row.transaction_hash || null,
    block_number: row.block_number !== null ? Number(row.block_number) : null,
    notes: row.notes || null,
    uploaded_by: row.uploaded_by,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  const cleanPrescription = (row) => ({
    id: Number(row.id),
    patient_id: Number(row.patient_id),
    doctor_id: Number(row.doctor_id),
    medicine_name: row.medicine_name,
    dosage: row.dosage,
    duration: row.duration || null,
    instructions: row.instructions || null,
    prescribed_date: row.prescribed_date ? new Date(row.prescribed_date).toISOString().slice(0, 10) : null,
    end_date: row.end_date ? new Date(row.end_date).toISOString().slice(0, 10) : null,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    updated_at: row.updated_at ? new Date(row.updated_at) : new Date(),
  });

  const cleanVitalSign = (row) => ({
    id: Number(row.id),
    patient_id: Number(row.patient_id),
    blood_pressure: row.blood_pressure || null,
    heart_rate: row.heart_rate !== null ? Number(row.heart_rate) : null,
    temperature: row.temperature !== null ? Number(row.temperature) : null,
    weight: row.weight !== null ? Number(row.weight) : null,
    recorded_date: row.recorded_date ? new Date(row.recorded_date) : new Date(),
    notes: row.notes || null,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  });

  const cleanRefreshToken = (row) => ({
    id: Number(row.id),
    user_id: Number(row.user_id),
    token_hash: row.token_hash,
    token_lookup_hash: tokenLookupHash(row.token_hash), // Fallback lookup hash
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
    revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
  });

  const cleanPatientAccessToken = (row) => ({
    id: Number(row.id),
    patient_id: Number(row.patient_id),
    doctor_id: Number(row.doctor_id),
    appointment_id: row.appointment_id !== null ? Number(row.appointment_id) : null,
    token: row.token,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    is_active: row.is_active === null ? true : !!row.is_active,
    used_at: row.used_at ? new Date(row.used_at) : null,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  });

  const cleanAccessLog = (row) => {
    let parsedMetadata = null;
    if (row.metadata) {
      try {
        parsedMetadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      } catch {
        parsedMetadata = row.metadata;
      }
    }
    return {
      id: Number(row.id),
      actor_user_id: row.actor_user_id !== null ? Number(row.actor_user_id) : null,
      patient_id: row.patient_id !== null ? Number(row.patient_id) : null,
      action: row.action,
      entity_type: row.entity_type || null,
      entity_id: row.entity_id || null,
      metadata: parsedMetadata,
      ip_address: row.ip_address || null,
      created_at: row.created_at ? new Date(row.created_at) : new Date(),
    };
  };

  const tasks = [
    { table: "users", collection: "users", cleaner: cleanUser, matchKey: "id" },
    { table: "doctor_profiles", collection: "doctor_profiles", cleaner: cleanDoctorProfile, matchKey: "user_id" },
    { table: "appointments", collection: "appointments", cleaner: cleanAppointment, matchKey: "id" },
    { table: "medical_records", collection: "medical_records", cleaner: cleanMedicalRecord, matchKey: "id" },
    { table: "prescriptions", collection: "prescriptions", cleaner: cleanPrescription, matchKey: "id" },
    { table: "vital_signs", collection: "vital_signs", cleaner: cleanVitalSign, matchKey: "id" },
    { table: "refresh_tokens", collection: "refresh_tokens", cleaner: cleanRefreshToken, matchKey: "id" },
    { table: "patient_access_tokens", collection: "patient_access_tokens", cleaner: cleanPatientAccessToken, matchKey: "id" },
    { table: "access_logs", collection: "access_logs", cleaner: cleanAccessLog, matchKey: "id" },
  ];

  for (const task of tasks) {
    console.log(`\n⏳ Migrating table "${task.table}"...`);
    const rows = await queryTable(task.table);
    if (!rows || rows.length === 0) {
      console.log(`ℹ️ Table "${task.table}" has no rows to migrate.`);
      continue;
    }

    let successCount = 0;
    let failCount = 0;
    let maxId = 0;

    for (const row of rows) {
      try {
        const cleaned = task.cleaner(row);
        
        // Find max ID for counter initialization (skip tables without sequential id)
        if (cleaned.id && cleaned.id > maxId) {
          maxId = cleaned.id;
        }

        // Upsert to Mongo
        const query = {};
        query[task.matchKey] = cleaned[task.matchKey];
        await mongoDb.collection(task.collection).updateOne(
          query,
          { $set: cleaned },
          { upsert: true }
        );
        successCount++;
      } catch (err) {
        console.error(`❌ Failed to migrate row from "${task.table}":`, err.message, row);
        failCount++;
      }
    }

    console.log(`✅ Migrated "${task.table}": ${successCount} success, ${failCount} failed.`);

    // Initialize sequence counter if maxId was tracked
    if (maxId > 0 && task.collection !== "doctor_profiles") {
      try {
        await mongoDb.collection("counters").updateOne(
          { _id: task.collection },
          { $set: { seq: maxId } },
          { upsert: true }
        );
        console.log(`   Initialized sequence counter for "${task.collection}" to: ${maxId}`);
      } catch (err) {
        console.error(`   ❌ Failed to set sequence counter for "${task.collection}":`, err.message);
      }
    }
  }

  console.log("\n🏁 Database migration completed successfully!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed with critical error:", err);
  process.exit(1);
});
