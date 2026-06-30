import express from "express";
const router = express.Router();
import { authenticateToken } from "../middleware/auth.js";
import db from "../config/db.js";

router.get("/search", authenticateToken, async (req, res, next) => {
  try {
    const query = req.query.query || '';
    let sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.phone,
        u.degree AS qualifications,
        dp.specialty,
        dp.experience_years,
        dp.consultation_fee,
        dp.bio,
        dp.available_days,
        dp.available_time_start,
        dp.available_time_end
      FROM users u
      INNER JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'doctor' AND u.is_verified = 1
    `;
    
    const params = [];
    
    if (query && query !== 'all') {
      sql += ` AND (
        u.name LIKE ? OR 
        dp.specialty LIKE ? OR 
        u.degree LIKE ? OR
        dp.bio LIKE ?
      )`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    sql += ` ORDER BY u.name`;
    
    const [doctors] = await db.query(sql, params);
    
    return res.json({ doctors });
  } catch (error) {
    next(error);
  }
});

export default router;