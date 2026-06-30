import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../config/db.js";

dotenv.config();

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!["patient", "doctor"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, role]
    );

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: { id: result.insertId, name, email, role }
    });
  } catch (error) {
    console.error("register error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const [rows] = await db.query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = ?",
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("login error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
