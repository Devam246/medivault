import rateLimit from "express-rate-limit";

/**
 * Auth rate limiter — applies to /auth/login and /auth/refresh only.
 * 5 attempts per 15 minutes, keyed by IP.
 * Returns a clear 429 response on limit exceeded.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 requests per window per IP
  standardHeaders: true,     // Return rate limit info in the RateLimit-* headers
  legacyHeaders: false,      // Disable the X-RateLimit-* headers
  message: {
    success: false,
    message: "Too many login attempts from this IP. Please try again after 15 minutes.",
  },
});
