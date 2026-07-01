import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../mongoTestHelper.js";
import { createUser, upsertDoctorProfile } from "../../src/repositories/userRepository.js";

let app;

function signToken(userId, role) {
  return jwt.sign({ id: userId, role }, "testsecret", { expiresIn: "15m" });
}

describe("Appointments Integration Tests", () => {
  let patient, doctor, patientToken, doctorToken;

  beforeAll(async () => {
    await startMongoTestServer();
    app = (await import("../../src/server.js")).default;
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    // 1. Create Patient
    patient = await createUser({
      name: "John Patient",
      email: "patient@example.com",
      password_hash: "hashed",
      role: "patient",
      is_verified: 1,
    });
    patientToken = signToken(patient.id, "patient");

    // 2. Create Doctor
    doctor = await createUser({
      name: "Jane Doctor",
      email: "doctor@example.com",
      password_hash: "hashed",
      role: "doctor",
      is_verified: 1,
    });
    doctorToken = signToken(doctor.id, "doctor");

    // Set up doctor availability profile
    await upsertDoctorProfile(doctor.id, {
      specialty: "General Medicine",
      qualification: "MD",
      experience_years: 5,
      consultation_fee: 100,
      location: "Room 101",
      bio: "General physician",
      available_days: "Mon,Tue,Wed,Thu,Fri",
      available_time_start: "09:00",
      available_time_end: "17:00",
    });
  });

  test("retrieves available slots for doctor", async () => {
    const res = await request(app)
      .get(`/appointments/doctor/${doctor.id}/slots`)
      .query({ date: "2026-07-06" }) // A Monday
      .set("Authorization", `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).toBeDefined();
    const hasSlot = res.body.slots.some(s => s.time === "09:00:00" && s.available === true);
    expect(hasSlot).toBe(true);
  });

  test("books an appointment, rejects double-booking, and cancels", async () => {
    const appointmentData = {
      doctor_id: doctor.id,
      appointment_date: "2026-07-06",
      appointment_time: "10:00:00",
      reason: "General Consultation",
    };

    // 1. Book successfully
    const bookRes = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send(appointmentData);

    expect(bookRes.status).toBe(200);
    expect(bookRes.body.appointmentId).toBeDefined();

    const appointmentId = bookRes.body.appointmentId;

    // 2. Try to book the same slot (should fail due to unique constraint / conflict)
    const duplicateRes = await request(app)
      .post("/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send(appointmentData);

    // returns 409 on slot collision
    expect(duplicateRes.status).toBe(409);

    // 3. Cancel the appointment
    const cancelRes = await request(app)
      .post(`/appointments/${appointmentId}/cancel`)
      .set("Authorization", `Bearer ${patientToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.message).toBe("Appointment cancelled successfully");
  });
});
