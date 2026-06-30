/**
 * config/env.js — Centralized secrets access layer.
 *
 * All sensitive environment variable reads MUST go through this file.
 * Never call process.env.JWT_SECRET, process.env.PRIVATE_KEY, etc. directly
 * in other files — always use these named getters instead.
 *
 * Why: In v2.0 this will swap to AWS Secrets Manager. That swap touches
 * only this file, not every file that needs a secret.
 *
 * Non-sensitive config (PORT, NODE_ENV, FRONTEND_URL) can still be read
 * directly from process.env where needed.
 */

import dotenv from "dotenv";
dotenv.config();

// --------------------
// SENSITIVE SECRETS (route through this file only)
// --------------------

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: JWT_SECRET");
  return secret;
}

export function getDbPass() {
  const pass = process.env.DB_PASS;
  if (!pass) throw new Error("Missing required env var: DB_PASS");
  return pass;
}

export function getPrivateKey() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("Missing required env var: PRIVATE_KEY");
  return key;
}

export function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing required env var: GROQ_API_KEY");
  return key;
}
