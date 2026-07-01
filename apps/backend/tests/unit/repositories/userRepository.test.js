import {
  createUser,
  getUserById,
  getUserByEmail,
  updateUserPasswordHash,
  listPendingDoctors,
  approveDoctorById,
  rejectPendingDoctorById,
  getSystemCounts,
  upsertDoctorProfile,
  getDoctorProfile,
  searchVerifiedDoctors,
  searchPatients,
} from "../../../src/repositories/userRepository.js";
import { startMongoTestServer, stopMongoTestServer, clearDatabase } from "../../mongoTestHelper.js";

describe("userRepository", () => {
  beforeAll(async () => {
    await startMongoTestServer();
  }, 300000);

  afterAll(async () => {
    await stopMongoTestServer();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  test("creates and finds user by ID and email", async () => {
    const payload = {
      name: "John Doe",
      email: "john@example.com",
      password_hash: "hashedpass",
      role: "patient",
      is_verified: 1,
    };

    const user = await createUser(payload);
    expect(user.id).toBeDefined();
    expect(user.name).toBe("John Doe");

    const foundById = await getUserById(user.id);
    expect(foundById.email).toBe("john@example.com");

    const foundByEmail = await getUserByEmail("john@example.com");
    expect(foundByEmail.id).toBe(user.id);
  });

  test("updates password hash", async () => {
    const user = await createUser({
      name: "User Pass",
      email: "pass@example.com",
      password_hash: "oldhash",
      role: "patient",
      is_verified: 1,
    });

    await updateUserPasswordHash(user.id, "newhash");
    const updated = await getUserById(user.id);
    expect(updated.password_hash).toBe("newhash");
  });

  test("manages pending doctors (list, approve, reject)", async () => {
    // Create pending doctor
    const dr1 = await createUser({
      name: "Dr. Pending One",
      email: "dr1@example.com",
      password_hash: "hash",
      role: "doctor",
      is_verified: 0,
      reg_number: "REG123",
      degree: "MD",
      document_path: "/uploads/doc1.pdf",
    });

    // Create verified doctor
    await createUser({
      name: "Dr. Verified",
      email: "dr2@example.com",
      password_hash: "hash",
      role: "doctor",
      is_verified: 1,
    });

    let pending = await listPendingDoctors();
    expect(pending).toHaveLength(1);
    expect(pending[0].name).toBe("Dr. Pending One");
    expect(pending[0].regNumber).toBe("REG123");

    // Approve doctor
    const approved = await approveDoctorById(dr1.id);
    expect(approved).toBe(1);

    pending = await listPendingDoctors();
    expect(pending).toHaveLength(0);

    const checkDr1 = await getUserById(dr1.id);
    expect(checkDr1.is_verified).toBe(1);

    // Create another pending doctor to test rejection
    const dr3 = await createUser({
      name: "Dr. Reject",
      email: "dr3@example.com",
      password_hash: "hash",
      role: "doctor",
      is_verified: 0,
    });

    pending = await listPendingDoctors();
    expect(pending).toHaveLength(1);

    const rejected = await rejectPendingDoctorById(dr3.id);
    expect(rejected).toBe(1);

    pending = await listPendingDoctors();
    expect(pending).toHaveLength(0);

    const checkDr3 = await getUserById(dr3.id);
    expect(checkDr3).toBeNull();
  });

  test("gets system counts", async () => {
    await createUser({ name: "P1", email: "p1@example.com", role: "patient", is_verified: 1 });
    await createUser({ name: "D1", email: "d1@example.com", role: "doctor", is_verified: 1 });

    const counts = await getSystemCounts();
    expect(counts.users).toBe(2);
  });

  test("manages doctor profile", async () => {
    const dr = await createUser({ name: "Dr. Profile", email: "drp@example.com", role: "doctor", is_verified: 1 });

    const profileData = {
      specialty: "Cardiology",
      qualification: "MD, DM",
      experience_years: 10,
      consultation_fee: 150,
      location: "Building A",
      bio: "Cardiologist bio",
      available_days: "monday,tuesday",
      available_time_start: "09:00",
      available_time_end: "17:00",
    };

    await upsertDoctorProfile(dr.id, profileData);

    const profile = await getDoctorProfile(dr.id);
    expect(profile.specialty).toBe("Cardiology");
    expect(profile.consultation_fee).toBe(150);
  });

  test("searches verified doctors", async () => {
    const dr = await createUser({ name: "Dr. House", email: "house@example.com", role: "doctor", is_verified: 1 });
    await upsertDoctorProfile(dr.id, {
      specialty: "Diagnostics",
      location: "Princeton",
      bio: "Brilliant diagnostician",
    });

    // Unverified doctor should not show up
    await createUser({ name: "Dr. Unverified", email: "unv@example.com", role: "doctor", is_verified: 0 });

    const resultsAll = await searchVerifiedDoctors("all");
    expect(resultsAll.some(d => d.name === "Dr. House")).toBe(true);
    expect(resultsAll.some(d => d.name === "Dr. Unverified")).toBe(false);

    const resultsSearch = await searchVerifiedDoctors("Diagnostics");
    expect(resultsSearch).toHaveLength(1);
    expect(resultsSearch[0].name).toBe("Dr. House");
  });

  test("searches patients", async () => {
    const p = await createUser({ name: "Alice Patient", email: "alice@example.com", role: "patient", is_verified: 1, phone: "12345", blood_group: "O+" });
    await createUser({ name: "Bob Doctor", email: "bob@example.com", role: "doctor", is_verified: 1 });

    const results = await searchPatients("Alice");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alice Patient");

    const noResults = await searchPatients("Bob"); // Doctor
    expect(noResults).toHaveLength(0);
  });
});
