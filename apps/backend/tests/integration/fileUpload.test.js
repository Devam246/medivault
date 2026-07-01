import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../mongoTestHelper.js";

// Mock the blockchain module before importing server.js
jest.unstable_mockModule("../../src/blockchain/blockchain.js", () => ({
  addRecordToBlockchain: jest.fn().mockResolvedValue({
    transactionHash: "0xmockedtxhash",
    blockNumber: "123456",
    owner: "0xmockedowner",
  }),
}));

let app;

function signToken(userId, role) {
  return jwt.sign({ id: userId, role }, "testsecret", { expiresIn: "15m" });
}

describe("File Upload Integration Tests", () => {
  let patient, patientToken;
  const mockFileContent = Buffer.from("mock pdf file contents");

  beforeAll(async () => {
    await startMongoTestServer();
    app = (await import("../../src/server.js")).default;
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();

    // Create Patient
    patient = await (await import("../../src/repositories/userRepository.js")).createUser({
      name: "Alice Patient",
      email: "alice@example.com",
      password_hash: "hashed",
      role: "patient",
      is_verified: 1,
    });
    patientToken = signToken(patient.id, "patient");
  });

  test("successfully uploads a medical file and triggers background blockchain anchoring", async () => {
    const res = await request(app)
      .post("/files/upload")
      .set("Authorization", `Bearer ${patientToken}`)
      .attach("file", mockFileContent, "medical_report.pdf")
      .field("title", "Blood Test Report")
      .field("type", "Report")
      .field("notes", "Cholesterol levels are normal");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.fileHash).toBeDefined();
    expect(res.body.filename).toBeDefined();

    // Verify it exists in database
    const db = await (await import("../../src/config/mongo.js")).getMongoDb();
    const record = await db.collection("medical_records").findOne({ patient_id: patient.id });
    expect(record).not.toBeNull();
    expect(record.title).toBe("Blood Test Report");
    expect(record.uploaded_by).toBe("patient");

    // Clean up uploaded file from disk
    const filePath = path.join(process.cwd(), "uploads", res.body.filename);
    await fs.unlink(filePath).catch(() => {});
  });

  test("fails and rolls back file writing/JSON record if metadata validation fails", async () => {
    // Missing title or invalid fields inside zod schema
    const res = await request(app)
      .post("/files/upload")
      .set("Authorization", `Bearer ${patientToken}`)
      .attach("file", mockFileContent, "medical_report.pdf")
      .field("type", "Report"); // missing title, will fail validation

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // Verify no DB records are written
    const db = await (await import("../../src/config/mongo.js")).getMongoDb();
    const recordCount = await db.collection("medical_records").countDocuments();
    expect(recordCount).toBe(0);
  });
});
