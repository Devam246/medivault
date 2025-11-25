import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// --------------------
// VERIFY JWT (AUTH MIDDLEWARE)
// --------------------
export function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1]; // Bearer token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

// --------------------
// ROLE CHECKER
// --------------------
// server/middleware/auth.js
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ 
        message: `Access denied. ${role} role required.` 
      });
    }
    
    next();
  };
}
