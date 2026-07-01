import argon2 from "argon2";
import bcrypt from "bcrypt"; // used only for the legacy rehash-on-login migration
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getJwtSecret } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import * as userRepository from "../repositories/userRepository.js";
import * as refreshTokenRepository from "../repositories/refreshTokenRepository.js";

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

    const existing = await userRepository.getUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const password_hash = await argon2.hash(password);
    await userRepository.createUser({
      name,
      email,
      password_hash,
      role: "patient",
      is_verified: 1,
    });
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

    const existing = await userRepository.getUserByEmail(email);
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const password_hash = await argon2.hash(password);
    await userRepository.createUser({
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

    const user = await userRepository.getUserByEmail(email);
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
      await userRepository.updateUserPasswordHash(user.id, newHash);
    } else {
      // Standard Argon2 path
      const valid = await argon2.verify(user.password_hash, password);
      if (!valid) return res.status(400).json({ message: "Invalid credentials" });
    }

    if (role === "doctor" && user.is_verified === 0)
      return res.status(403).json({ message: "Doctor not verified by admin yet" });

    // JWTs
    const accessToken = generateAccessToken(user);
    const rawToken = generateRefreshToken();
    const refreshToken = `${user.id}.${rawToken}`;
    const refreshHash = await hashToken(refreshToken);

    await refreshTokenRepository.insertRefreshToken(user.id, refreshHash, refreshToken);

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

    const parts = refreshToken.split(".");
    if (parts.length !== 2) {
      throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");
    }

    const userId = Number(parts[0]);
    if (isNaN(userId)) {
      throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");
    }

    // Get active tokens for the specific user (indexed lookup)
    const storedTokens = await refreshTokenRepository.getRefreshTokensByUserId(userId);
    let matchedToken = null;

    for (const tokenRow of storedTokens) {
      if (await argon2.verify(tokenRow.token_hash, refreshToken)) {
        matchedToken = tokenRow;
        break;
      }
    }

    if (!matchedToken) throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");

    const user = await userRepository.getUserById(userId);
    if (!user) throw new AppError("Invalid refresh token", 403, "INVALID_TOKEN");

    const newAccessToken = generateAccessToken(user);

    return res.json({ token: newAccessToken });
  } catch (err) {
    next(err);
  }
}
