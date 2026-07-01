import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../mongoTestHelper.js";
import { createUser, getUserById } from "../../src/repositories/userRepository.js";

let app;

function signToken(userId, role) {
  return jwt.sign({ id: userId, role }, "testsecret", { expiresIn: "15m" });
}

describe("Admin Integration Tests", () => {
  let adminToken, doctor;

  beforeAll(async () => {
    await startMongoTestServer();
    app = (await import("../../src/server.js")).default;
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    // 1. Create Admin and sign token
    const admin = await createUser({
      name: "System Admin",
      email: "admin@medivault.com",
      password_hash: "hashed",
      role: "admin",
      is_verified: 1,
    });
    adminToken = signToken(admin.id, "admin");

    // 2. Create unverified Doctor
    doctor = await createUser({
      name: "Dr. Gregory House",
      email: "house@example.com",
      password_hash: "hashed",
      role: "doctor",
      is_verified: 0,
      reg_number: "REG999",
      degree: "MD",
    });
  });

  test("retrieves pending doctor list", async () => {
    const res = await request(app)
      .get("/admin/doctors")
      .query({ status: "pending" })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.doctors).toHaveLength(1);
    expect(res.body.doctors[0].name).toBe("Dr. Gregory House");
  });

  test("approves a doctor successfully", async () => {
    const res = await request(app)
      .post(`/admin/doctors/${doctor.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Doctor approved successfully");

    const checkDoctor = await getUserById(doctor.id);
    expect(checkDoctor.is_verified).toBe(1);
  });

  test("rejects a doctor successfully (deletes user)", async () => {
    const res = await request(app)
      .post(`/admin/doctors/${doctor.id}/reject`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Doctor rejected successfully");

    const checkDoctor = await getUserById(doctor.id);
    expect(checkDoctor).toBeNull();
  });

  test("retrieves system statistics", async () => {
    const res = await request(app)
      .get("/admin/stats")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toBe(2); // 1 admin + 1 doctor
    expect(res.body.records).toBe(0);
    expect(res.body.appointments).toBe(0);
  });
});
