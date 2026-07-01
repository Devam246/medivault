import { jest } from "@jest/globals";
import request from "supertest";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../mongoTestHelper.js";
import { authLimiter } from "../../src/middleware/rateLimiter.js";

let app;

describe("Auth Integration Tests", () => {
  beforeAll(async () => {
    await startMongoTestServer();
    // Dynamically import the app after Mongo memory server is running so it uses the test DB
    app = (await import("../../src/server.js")).default;
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(() => {
    if (authLimiter && typeof authLimiter.resetKey === "function") {
      authLimiter.resetKey("127.0.0.1");
      authLimiter.resetKey("::ffff:127.0.0.1");
    }
  });

  test("registers a patient and logs in successfully", async () => {
    // 1. Register Patient
    const regRes = await request(app)
      .post("/auth/register")
      .send({
        name: "Alice Smith",
        email: "alice.smith@example.com",
        password: "securepassword123",
      });

    expect(regRes.status).toBe(200);
    expect(regRes.body.message).toBe("Patient registered successfully");

    // 2. Login
    const loginRes = await request(app)
      .post("/auth/login")
      .send({
        email: "alice.smith@example.com",
        password: "securepassword123",
        role: "patient",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
    expect(loginRes.body.role).toBe("patient");
  });

  test("fails login with wrong role or invalid credentials", async () => {
    // Register patient
    await request(app)
      .post("/auth/register")
      .send({
        name: "Alice Smith",
        email: "alice.smith@example.com",
        password: "securepassword123",
      });

    // Login with wrong role
    const loginRoleRes = await request(app)
      .post("/auth/login")
      .send({
        email: "alice.smith@example.com",
        password: "securepassword123",
        role: "doctor",
      });
    expect(loginRoleRes.status).toBe(400);

    // Login with wrong password
    const loginPassRes = await request(app)
      .post("/auth/login")
      .send({
        email: "alice.smith@example.com",
        password: "wrongpassword",
        role: "patient",
      });
    expect(loginPassRes.status).toBe(400);
  });

  test("can refresh tokens using valid refresh token", async () => {
    await request(app)
      .post("/auth/register")
      .send({
        name: "Alice Smith",
        email: "alice.smith@example.com",
        password: "securepassword123",
      });

    const loginRes = await request(app)
      .post("/auth/login")
      .send({
        email: "alice.smith@example.com",
        password: "securepassword123",
        role: "patient",
      });

    const refreshToken = loginRes.body.refreshToken;

    const refreshRes = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();
  });

  test("triggers rate limiting after 5 failed login attempts", async () => {
    // Attempt login 5 times with bad password
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "badpassword",
          role: "patient",
        });
      // The first 5 should fail with 401 or 400 (not 429)
      expect(res.status).not.toBe(429);
    }

    // 6th attempt should trigger rate limiting (429)
    const rateLimitRes = await request(app)
      .post("/auth/login")
      .send({
        email: "nonexistent@example.com",
        password: "badpassword",
        role: "patient",
      });

    expect(rateLimitRes.status).toBe(429);
    expect(rateLimitRes.body.success).toBe(false);
    expect(rateLimitRes.body.message).toContain("Too many login attempts");
  });
});
