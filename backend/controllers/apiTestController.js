import db from "../config/db.js";

export function apiHealth(_req, res) {
  return res.json({ success: true, message: "API working" });
}

export async function getAllUsers(req, res) {
  try {
    const [users] = await db.query("SELECT id, name, email, role FROM users ORDER BY id DESC");
    return res.json({ success: true, users });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
