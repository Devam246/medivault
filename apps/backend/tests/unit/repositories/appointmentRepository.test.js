import {
  createAppointment,
  findAppointmentById,
  updateAppointmentStatus,
  listAppointmentsByPatient,
  listAppointmentsByDoctor,
  getBookedTimes,
} from "../../../src/repositories/appointmentRepository.js";
import { createUser } from "../../../src/repositories/userRepository.js";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../../mongoTestHelper.js";

describe("appointmentRepository", () => {
  let patient, doctor;

  beforeAll(async () => {
    await startMongoTestServer();
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create users to link in appointments
    patient = await createUser({
      name: "Patient One",
      email: "patient@example.com",
      password_hash: "hash",
      role: "patient",
      is_verified: 1,
    });

    doctor = await createUser({
      name: "Doctor One",
      email: "doctor@example.com",
      password_hash: "hash",
      role: "doctor",
      is_verified: 1,
    });
  });

  test("creates and finds appointment by ID", async () => {
    const payload = {
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "10:00:00",
      reason: "Routine checkup",
      status: "pending",
    };

    const appt = await createAppointment(payload);
    expect(appt.id).toBeDefined();
    expect(appt.reason).toBe("Routine checkup");

    const found = await findAppointmentById(appt.id);
    expect(found.patient_id).toBe(patient.id);
    expect(found.doctor_id).toBe(doctor.id);
  });

  test("updates appointment status", async () => {
    const appt = await createAppointment({
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "10:00:00",
      reason: "Checkup",
      status: "pending",
    });

    await updateAppointmentStatus(appt.id, "confirmed");
    const updated = await findAppointmentById(appt.id);
    expect(updated.status).toBe("confirmed");
  });

  test("lists appointments by patient and doctor", async () => {
    await createAppointment({
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "10:00:00",
      reason: "Checkup 1",
      status: "confirmed",
    });

    const patientList = await listAppointmentsByPatient(patient.id);
    expect(patientList).toHaveLength(1);
    expect(patientList[0].doctor_name).toBe("Doctor One");

    const doctorList = await listAppointmentsByDoctor(doctor.id);
    expect(doctorList).toHaveLength(1);
    expect(doctorList[0].patient_name).toBe("Patient One");
  });

  test("retrieves booked times for doctor and date", async () => {
    await createAppointment({
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "10:00:00",
      status: "confirmed",
    });

    await createAppointment({
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "11:00:00",
      status: "pending",
    });

    // Cancelled status should not be returned as booked
    await createAppointment({
      patient_id: patient.id,
      doctor_id: doctor.id,
      appointment_date: "2026-07-05",
      appointment_time: "12:00:00",
      status: "cancelled",
    });

    const booked = await getBookedTimes(doctor.id, "2026-07-05");
    expect(booked.has("10:00:00")).toBe(true);
    expect(booked.has("11:00:00")).toBe(true);
    expect(booked.has("12:00:00")).toBe(false);
  });
});
