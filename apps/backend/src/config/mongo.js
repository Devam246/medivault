import { MongoClient } from "mongodb";
import { getMongoDbName, getMongoUri } from "./env.js";

let client;
let database;

export function isMongoEnabled() {
  return process.env.DATA_STORE === "mongo";
}

export async function getMongoDb() {
  if (database) return database;

  client = new MongoClient(getMongoUri());
  await client.connect();
  database = client.db(getMongoDbName());
  return database;
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

export async function ensureMongoIndexes() {
  const db = await getMongoDb();

  await db.collection("counters").createIndex({ _id: 1 }, { unique: true });

  await db.collection("users").createIndex({ id: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("users").createIndex({ role: 1 });
  await db.collection("users").createIndex({ role: 1, is_verified: 1 });
  await db.collection("users").createIndex({ phone: 1 });

  await db.collection("doctor_profiles").createIndex({ user_id: 1 }, { unique: true });
  await db.collection("doctor_profiles").createIndex({ specialty: 1 });
  await db.collection("doctor_profiles").createIndex({ location: 1 });

  await db.collection("appointments").createIndex({ id: 1 }, { unique: true });
  await db.collection("appointments").createIndex(
    { doctor_id: 1, appointment_date: 1, appointment_time: 1 },
    {
      unique: true,
      partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
    }
  );
  await db.collection("appointments").createIndex({ patient_id: 1, appointment_date: -1 });
  await db.collection("appointments").createIndex({ doctor_id: 1, appointment_date: -1 });

  await db.collection("medical_records").createIndex({ id: 1 }, { unique: true });
  await db.collection("medical_records").createIndex({ patient_id: 1, record_date: -1 });
  await db.collection("medical_records").createIndex({ doctor_id: 1 });

  await db.collection("prescriptions").createIndex({ id: 1 }, { unique: true });
  await db.collection("prescriptions").createIndex({ patient_id: 1, prescribed_date: -1 });
  await db.collection("prescriptions").createIndex({ doctor_id: 1 });
  await db.collection("prescriptions").createIndex({ patient_id: 1, end_date: 1 });

  await db.collection("vital_signs").createIndex({ id: 1 }, { unique: true });
  await db.collection("vital_signs").createIndex({ patient_id: 1, recorded_date: -1 });

  await db.collection("refresh_tokens").createIndex({ user_id: 1 });
  await db.collection("refresh_tokens").createIndex({ token_lookup_hash: 1 }, { unique: true });

  await db.collection("patient_access_tokens").createIndex({ id: 1 }, { unique: true });
  await db.collection("patient_access_tokens").createIndex({ token: 1 }, { unique: true });
  await db.collection("patient_access_tokens").createIndex({ patient_id: 1, doctor_id: 1, is_active: 1, expires_at: 1 });
  await db.collection("patient_access_tokens").createIndex({ appointment_id: 1 });

  await db.collection("access_logs").createIndex({ actor_user_id: 1 });
  await db.collection("access_logs").createIndex({ patient_id: 1 });
  await db.collection("access_logs").createIndex({ action: 1, created_at: -1 });
}
