import argon2 from "argon2";
import bcrypt from "bcrypt"; // used only for the legacy rehash-on-login migration
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import crypto from "crypto";
import { getJwtSecret } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { isMongoEnabled } from "../config/mongo.js";
import {
  createUser,
  getRefreshTokenByRawToken,
  getUserByEmail,
  getUserById,
  insertRefreshToken,
  updateUserPasswordHash,
} from "../repositories/mongoRepository.js";

// --------------------
// JWT GENERATORS
// --------------------
function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    getJwtSecret(),
    { expiresIn: "15m" }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString("hex");
}

// HASH refresh token
async function hashToken(token) {
  return await argon2.hash(token);
}

// --------------------
// PATIENT REGISTRATION
// --------------------
export async function registerPatient(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    if (isMongoEnabled()) {
      const existing = await getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const password_hash = await argon2.hash(password);
      await createUser({
        name,
        email,
        password_hash,
        role: "patient",
        is_verified: 1,
      });
      return res.json({ message: "Patient registered successfully" });
    }

    // Check if email exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(400).json({ message: "Email already registered" });

    const password_hash = await argon2.hash(password);

    await db.query(
      "INSERT INTO users (name, email, password_hash, role, is_verified) VALUES (?, ?, ?, 'patient', 1)",
      [name, email, password_hash]
    );

    return res.json({ message: "Patient registered successfully" });

  } catch (err) {
    next(err);
  }
}

// --------------------
// DOCTOR REGISTRATION
// --------------------
export async function registerDoctor(req, res, next) {
  try {
    const { name, email, password, regNumber, degree } = req.body;
    const documentFile = req.file; // multer
    const documentPath = documentFile ? documentFile.path : null;

    if (!name || !email || !password || !regNumber || !degree)
      return res.status(400).json({ message: "All fields are required" });

    if (isMongoEnabled()) {
      const existing = await getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "Email already registered" });

      const password_hash = await argon2.hash(password);
      await createUser({
        name,
        email,
        password_hash,
        role: "doctor",
        reg_number: regNumber,
        degree,
        document_path: documentPath,
        is_verified: 0,
      });
      return res.json({ message: "Doctor registration submitted for admin approval" });
    }

    // Check if email exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) return res.status(400).json({ message: "Email already registered" });

    const password_hash = await argon2.hash(password);

    await db.query(
      `INSERT INTO users 
        (name, email, password_hash, role, reg_number, degree, document_path, is_verified) 
       VALUES (?, ?, ?, 'doctor', ?, ?, ?, ?)`,
      [name, email, password_hash, regNumber, degree, documentPath, 0] // 0 → pending
    );

    return res.json({ message: "Doctor registration submitted for admin approval" });

  } catch (err) {
    next(err);
  }
}

// --------------------
// LOGIN
// --------------------
export async function login(req, res, next) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role)
      return res.status(400).json({ message: "All fields are required" });

    const user = isMongoEnabled()
      ? await getUserByEmail(email)
      : (await db.query("SELECT * FROM users WHERE email = ?", [email]))[0][0];
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (user.role !== role) return res.status(400).json({ message: "Incorrect role" });

    // --------------------
    // BCRYPT → ARGON2 REHASH MIGRATION
    // Bcrypt hashes start with $2b$ or $2a$. If we detect one, verify with
    // bcrypt, then immediately re-hash the plaintext with Argon2 and update
    // the row. After this, the user's hash is Argon2 and this branch never
    // runs for them again.
    // --------------------
    const isBcrypt = user.password_hash.startsWith("$2b$") || user.password_hash.startsWith("$2a$");
    if (isBcrypt) {
      const validBcrypt = await bcrypt.compare(password, user.password_hash);
      if (!validBcrypt) return res.status(400).json({ message: "Invalid credentials" });
      // Re-hash with Argon2 and persist
      const newHash = await argon2.hash(password);
      if (isMongoEnabled()) {
        await updateUserPasswordHash(user.id, newHash);
      } else {
        await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, user.id]);
      }
    } else {
      // Standard Argon2 path
      const valid = await argon2.verify(user.password_hash, password);
      if (!valid) return res.status(400).json({ message: "Invalid credentials" });
    }

    if (role === "doctor" && user.is_verified === 0)
      return res.status(403).json({ message: "Doctor not verified by admin yet" });

    // JWTs
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const refreshHash = await hashToken(refreshToken);

    if (isMongoEnabled()) {
      await insertRefreshToken(user.id, refreshHash, refreshToken);
    } else {
      await db.query("INSERT INTO refresh_tokens (user_id, token_hash) VALUES (?, ?)", [user.id, refreshHash]);
    }

    return res.json({
      token: accessToken,
      refreshToken: refreshToken,
      role: user.role
    });

  } catch (err) {
    next(err);
  }
}

// --------------------
// REFRESH TOKEN
// --------------------
export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError("Missing token", 400, "VALIDATION_ERROR");

    if (isMongoEnabled()) {
      const storedToken = await getRefreshTokenByRawToken(refreshToken);
      if (!storedToken || !(await argon2.verify(storedToken.token_hash, refreshToken))) {
        throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");
      }

      const user = await getUserById(storedToken.user_id);
      if (!user) throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");

      const newAccessToken = generateAccessToken(user);
      return res.json({ token: newAccessToken });
    }

    const [rows] = await db.query("SELECT * FROM refresh_tokens");
    let storedToken = null;

    for (const row of rows) {
      if (await argon2.verify(row.token_hash, refreshToken)) {
        storedToken = row;
        break;
      }
    }

    if (!storedToken) throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [storedToken.user_id]);
    const user = users[0];
    const newAccessToken = generateAccessToken(user);

    return res.json({ token: newAccessToken });
  } catch (err) {
    next(err);
  }
}
