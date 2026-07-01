import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import * as mongo from "./mongoRepository.js";

export async function insertRefreshToken(userId, tokenHash, rawToken) {
  if (isMongoEnabled()) {
    return mongo.insertRefreshToken(userId, tokenHash, rawToken);
  }
  await db.query("INSERT INTO refresh_tokens (user_id, token_hash) VALUES (?, ?)", [Number(userId), tokenHash]);
}

export async function getRefreshTokensByUserId(userId) {
  if (isMongoEnabled()) {
    // Mongo does not strictly need this lookup, but we can query refresh_tokens by user_id
    const mongoDb = await (await import("../config/mongo.js")).getMongoDb();
    return mongoDb.collection("refresh_tokens").find({ user_id: Number(userId), revoked_at: null }).toArray();
  }
  const [rows] = await db.query("SELECT * FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL", [Number(userId)]);
  return rows;
}
