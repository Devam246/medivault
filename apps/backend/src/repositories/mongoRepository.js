import crypto from "crypto";
import { getMongoDb } from "../config/mongo.js";

function now() {
  return new Date();
}

function publicDoc(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return rest;
}

function like(value, query) {
  return String(value || "").toLowerCase().includes(String(query || "").toLowerCase());
}

export function tokenLookupHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function nextSequence(name) {
  const db = await getMongoDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return result.seq;
}

export async function getUserByEmail(email) {
  const db = await getMongoDb();
  return db.collection("users").findOne({ email });
}

export async function getUserById(id) {
  const db = await getMongoDb();
  return db.collection("users").findOne({ id: Number(id) });
}

export async function createUser(payload) {
  const db = await getMongoDb();
  const id = await nextSequence("users");
  const user = {
    id,
    ...payload,
    created_at: now(),
    updated_at: now(),
  };
  await db.collection("users").insertOne(user);
  return user;
}

export async function updateUserPasswordHash(id, passwordHash) {
  const db = await getMongoDb();
  await db.collection("users").updateOne(
    { id: Number(id) },
    { $set: { password_hash: passwordHash, updated_at: now() } }
  );
}

export async function insertRefreshToken(userId, tokenHash, rawToken) {
  const db = await getMongoDb();
  await db.collection("refresh_tokens").insertOne({
    id: await nextSequence("refresh_tokens"),
    user_id: Number(userId),
    token_hash: tokenHash,
    token_lookup_hash: tokenLookupHash(rawToken),
    created_at: now(),
    revoked_at: null,
  });
}

export async function getRefreshTokenByRawToken(rawToken) {
  const db = await getMongoDb();
  return db.collection("refresh_tokens").findOne({
    token_lookup_hash: tokenLookupHash(rawToken),
    revoked_at: null,
  });
}

export async function listPendingDoctors() {
  const db = await getMongoDb();
  const docs = await db.collection("users")
    .find({ role: "doctor", is_verified: 0 })
    .sort({ name: 1 })
    .project({ _id: 0, id: 1, name: 1, email: 1, reg_number: 1, degree: 1, document_path: 1 })
    .toArray();
  return docs.map((doctor) => ({
    id: doctor.id,
    name: doctor.name,
    email: doctor.email,
    regNumber: doctor.reg_number,
    degree: doctor.degree,
    documentPath: doctor.document_path,
  }));
}

export async function approveDoctorById(id) {
  const db = await getMongoDb();
  const result = await db.collection("users").updateOne(
    { id: Number(id), role: "doctor" },
    { $set: { is_verified: 1, updated_at: now() } }
  );
  return result.modifiedCount;
}

export async function rejectPendingDoctorById(id) {
  const db = await getMongoDb();
  const result = await db.collection("users").deleteOne({
    id: Number(id),
    role: "doctor",
    is_verified: 0,
  });
  return result.deletedCount;
}

export async function getSystemCounts() {
  const db = await getMongoDb();
  const [users, records, appointments] = await Promise.all([
    db.collection("users").countDocuments(),
    db.collection("medical_records").countDocuments(),
    db.collection("appointments").countDocuments(),
  ]);
  return { users, records, appointments };
}

export async function upsertDoctorProfile(userId, payload) {
  const db = await getMongoDb();
  await db.collection("doctor_profiles").updateOne(
    { user_id: Number(userId) },
    {
      $set: {
        ...payload,
        user_id: Number(userId),
        updated_at: now(),
      },
      $setOnInsert: {
        id: await nextSequence("doctor_profiles"),
        created_at: now(),
      },
    },
    { upsert: true }
  );
}

export async function getDoctorProfile(userId) {
  const db = await getMongoDb();
  return db.collection("doctor_profiles").findOne({ user_id: Number(userId) });
}

export async function searchVerifiedDoctors(query = "all") {
  const db = await getMongoDb();
  const [users, profiles] = await Promise.all([
    db.collection("users").find({ role: "doctor", is_verified: 1 }).project({ _id: 0, password_hash: 0 }).toArray(),
    db.collection("doctor_profiles").find({}).project({ _id: 0 }).toArray(),
  ]);
  const byUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const doctors = users.map((user) => ({ ...user, ...(byUserId.get(user.id) || {}) }));
  const filtered = query && query !== "all"
    ? doctors.filter((doctor) =>
        like(doctor.name, query) ||
        like(doctor.specialty, query) ||
        like(doctor.location, query) ||
        like(doctor.degree, query) ||
        like(doctor.bio, query)
      )
    : doctors;
  return filtered
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      degree: doctor.degree,
      qualifications: doctor.degree,
      specialty: doctor.specialty,
      qualification: doctor.qualification,
      experience_years: doctor.experience_years,
      consultation_fee: doctor.consultation_fee,
      location: doctor.location,
      bio: doctor.bio,
      available_days: doctor.available_days,
      available_time_start: doctor.available_time_start,
      available_time_end: doctor.available_time_end,
    }));
}

export async function searchPatients(query = "") {
  const db = await getMongoDb();
  const patients = await db.collection("users")
    .find({ role: "patient" })
    .project({ _id: 0, id: 1, name: 1, email: 1, phone: 1, blood_group: 1 })
    .toArray();
  if (!query) return [];
  return patients.filter((patient) =>
    String(patient.id) === String(query) ||
    like(patient.name, query) ||
    like(patient.email, query) ||
    like(patient.phone, query)
  );
}

export async function createAppointment(payload) {
  const db = await getMongoDb();
  const appointment = {
    id: await nextSequence("appointments"),
    ...payload,
    patient_id: Number(payload.patient_id),
    doctor_id: Number(payload.doctor_id),
    status: payload.status || "pending",
    created_at: now(),
    updated_at: now(),
  };
  await db.collection("appointments").insertOne(appointment);
  return appointment;
}

export async function findAppointmentById(id) {
  const db = await getMongoDb();
  return db.collection("appointments").findOne({ id: Number(id) });
}

export async function updateAppointmentStatus(id, status) {
  const db = await getMongoDb();
  return db.collection("appointments").updateOne(
    { id: Number(id) },
    { $set: { status, updated_at: now() } }
  );
}

export async function listAppointmentsByPatient(patientId) {
  const db = await getMongoDb();
  const [appointments, doctors, profiles, tokens] = await Promise.all([
    db.collection("appointments").find({ patient_id: Number(patientId) }).sort({ appointment_date: -1, appointment_time: -1 }).toArray(),
    db.collection("users").find({ role: "doctor" }).project({ _id: 0, id: 1, name: 1 }).toArray(),
    db.collection("doctor_profiles").find({}).project({ _id: 0 }).toArray(),
    db.collection("patient_access_tokens").find({ patient_id: Number(patientId), is_active: true }).project({ _id: 0 }).toArray(),
  ]);
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const tokenByAppointmentId = new Map(tokens.map((token) => [token.appointment_id, token]));
  return appointments.map((appointment) => {
    const doctor = doctorById.get(appointment.doctor_id) || {};
    const profile = profileByUserId.get(appointment.doctor_id) || {};
    const token = tokenByAppointmentId.get(appointment.id) || {};
    return publicDoc({
      ...appointment,
      doctor_name: doctor.name,
      specialty: profile.specialty,
      access_token: token.token,
      token_expiry: token.expires_at,
    });
  });
}

export async function listAppointmentsByDoctor(doctorId) {
  const db = await getMongoDb();
  const [appointments, patients, tokens] = await Promise.all([
    db.collection("appointments").find({ doctor_id: Number(doctorId) }).sort({ appointment_date: -1, appointment_time: -1 }).toArray(),
    db.collection("users").find({ role: "patient" }).project({ _id: 0, id: 1, name: 1, email: 1, phone: 1 }).toArray(),
    db.collection("patient_access_tokens").find({ doctor_id: Number(doctorId), is_active: true }).project({ _id: 0 }).toArray(),
  ]);
  const patientById = new Map(patients.map((patient) => [patient.id, patient]));
  const tokenByAppointmentId = new Map(tokens.map((token) => [token.appointment_id, token]));
  return appointments.map((appointment) => {
    const patient = patientById.get(appointment.patient_id) || {};
    const token = tokenByAppointmentId.get(appointment.id) || {};
    return publicDoc({
      ...appointment,
      patient_name: patient.name,
      patient_email: patient.email,
      patient_phone: patient.phone,
      access_token: token.token,
    });
  });
}

export async function getBookedTimes(doctorId, date) {
  const db = await getMongoDb();
  const rows = await db.collection("appointments")
    .find({
      doctor_id: Number(doctorId),
      appointment_date: date,
      status: { $in: ["confirmed", "pending"] },
    })
    .project({ _id: 0, appointment_time: 1 })
    .toArray();
  return new Set(rows.map((row) => row.appointment_time));
}

export async function deactivateAccessTokens(patientId, doctorId) {
  const db = await getMongoDb();
  await db.collection("patient_access_tokens").updateMany(
    { patient_id: Number(patientId), doctor_id: Number(doctorId), is_active: true },
    { $set: { is_active: false } }
  );
}

export async function createPatientAccessToken(payload) {
  const db = await getMongoDb();
  const token = {
    id: await nextSequence("patient_access_tokens"),
    ...payload,
    patient_id: Number(payload.patient_id),
    doctor_id: Number(payload.doctor_id),
    appointment_id: payload.appointment_id == null ? null : Number(payload.appointment_id),
    is_active: true,
    created_at: now(),
    used_at: null,
  };
  await db.collection("patient_access_tokens").insertOne(token);
  return token;
}

export async function findActiveAccessToken(token, doctorId) {
  const db = await getMongoDb();
  return db.collection("patient_access_tokens").findOne({
    token,
    doctor_id: Number(doctorId),
    is_active: true,
    $or: [{ expires_at: null }, { expires_at: { $gt: now() } }],
  });
}

export async function findActiveGrant(patientId, doctorId) {
  const db = await getMongoDb();
  return db.collection("patient_access_tokens")
    .find({
      patient_id: Number(patientId),
      doctor_id: Number(doctorId),
      is_active: true,
      $or: [{ expires_at: null }, { expires_at: { $gt: now() } }],
    })
    .sort({ created_at: -1 })
    .limit(1)
    .next();
}

export async function markAccessTokenUsed(id) {
  const db = await getMongoDb();
  await db.collection("patient_access_tokens").updateOne(
    { id: Number(id) },
    { $set: { used_at: now() } }
  );
}

export async function getPatientProfile(patientId) {
  const user = await getUserById(patientId);
  if (!user || user.role !== "patient") return null;
  const { _id, password_hash, ...profile } = user;
  return profile;
}

export async function updatePatientProfile(patientId, payload) {
  const db = await getMongoDb();
  await db.collection("users").updateOne(
    { id: Number(patientId), role: "patient" },
    { $set: { ...payload, updated_at: now() } }
  );
}

export async function listMedicalRecords(patientId, limit = 0) {
  const db = await getMongoDb();
  let cursor = db.collection("medical_records")
    .find({ patient_id: Number(patientId) })
    .sort({ record_date: -1 });
  if (limit) cursor = cursor.limit(limit);
  const [records, doctors] = await Promise.all([
    cursor.toArray(),
    db.collection("users").find({ role: "doctor" }).project({ _id: 0, id: 1, name: 1 }).toArray(),
  ]);
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  return records.map((record) => publicDoc({
    ...record,
    doctor_name: doctorById.get(record.doctor_id)?.name,
  }));
}

export async function findMedicalRecordForPatient(recordId, patientId) {
  const db = await getMongoDb();
  return db.collection("medical_records").findOne({
    id: Number(recordId),
    patient_id: Number(patientId),
  });
}

export async function deleteMedicalRecord(recordId) {
  const db = await getMongoDb();
  return db.collection("medical_records").deleteOne({ id: Number(recordId) });
}

export async function createMedicalRecord(payload) {
  const db = await getMongoDb();
  const record = {
    id: await nextSequence("medical_records"),
    ...payload,
    patient_id: Number(payload.patient_id),
    doctor_id: payload.doctor_id == null ? null : Number(payload.doctor_id),
    created_at: now(),
    updated_at: now(),
  };
  await db.collection("medical_records").insertOne(record);
  return record;
}

export async function listPrescriptions(patientId, limit = 0, activeOnly = false) {
  const db = await getMongoDb();
  const filter = { patient_id: Number(patientId) };
  if (activeOnly) filter.end_date = { $gte: new Date().toISOString().slice(0, 10) };
  let cursor = db.collection("prescriptions").find(filter).sort({ prescribed_date: -1 });
  if (limit) cursor = cursor.limit(limit);
  const [prescriptions, doctors] = await Promise.all([
    cursor.toArray(),
    db.collection("users").find({ role: "doctor" }).project({ _id: 0, id: 1, name: 1 }).toArray(),
  ]);
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]));
  return prescriptions.map((prescription) => publicDoc({
    ...prescription,
    doctor_name: doctorById.get(prescription.doctor_id)?.name,
  }));
}

export async function listPrescriptionsForDoctorPatient(doctorId, patientId) {
  const db = await getMongoDb();
  const prescriptions = await db.collection("prescriptions")
    .find({ doctor_id: Number(doctorId), patient_id: Number(patientId) })
    .sort({ prescribed_date: -1 })
    .toArray();
  const doctor = await getUserById(doctorId);
  return prescriptions.map((prescription) => publicDoc({
    ...prescription,
    doctor_name: doctor?.name,
  }));
}

export async function createPrescription(payload) {
  const db = await getMongoDb();
  const prescription = {
    id: await nextSequence("prescriptions"),
    ...payload,
    patient_id: Number(payload.patient_id),
    doctor_id: Number(payload.doctor_id),
    created_at: now(),
    updated_at: now(),
  };
  await db.collection("prescriptions").insertOne(prescription);
  const doctor = await getUserById(prescription.doctor_id);
  return publicDoc({ ...prescription, doctor_name: doctor?.name });
}

export async function listVitals(patientId, limit = 0) {
  const db = await getMongoDb();
  let cursor = db.collection("vital_signs")
    .find({ patient_id: Number(patientId) })
    .sort({ recorded_date: -1 });
  if (limit) cursor = cursor.limit(limit);
  return (await cursor.toArray()).map(publicDoc);
}

export async function createVitalSign(payload) {
  const db = await getMongoDb();
  const vital = {
    id: await nextSequence("vital_signs"),
    ...payload,
    patient_id: Number(payload.patient_id),
    created_at: now(),
  };
  await db.collection("vital_signs").insertOne(vital);
  return vital;
}

export async function getPatientHistoryBundle(patientId) {
  const [profile, vitals, records, prescriptions, appointments] = await Promise.all([
    getPatientProfile(patientId),
    listVitals(patientId),
    listMedicalRecords(patientId),
    listPrescriptions(patientId),
    listAppointmentsByPatient(patientId),
  ]);
  return { profile, vitals, records, prescriptions, appointments };
}
