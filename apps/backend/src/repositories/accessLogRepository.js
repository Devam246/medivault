import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import { getMongoDb } from "../config/mongo.js";

export async function logAccess({
  actor_user_id,
  patient_id,
  action,
  entity_type,
  entity_id,
  metadata,
  ip_address,
}) {
  const metaStr = metadata ? JSON.stringify(metadata) : null;
  
  if (isMongoEnabled()) {
    try {
      const mongoDb = await getMongoDb();
      await mongoDb.collection("access_logs").insertOne({
        actor_user_id: actor_user_id ? Number(actor_user_id) : null,
        patient_id: patient_id ? Number(patient_id) : null,
        action,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        metadata: metadata || null,
        ip_address: ip_address || null,
        created_at: new Date(),
      });
    } catch (err) {
      console.error("❌ Failed to write MongoDB access log:", err.message);
    }
  } else {
    try {
      await db.query(
        `INSERT INTO access_logs 
          (actor_user_id, patient_id, action, entity_type, entity_id, metadata, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          actor_user_id ? Number(actor_user_id) : null,
          patient_id ? Number(patient_id) : null,
          action,
          entity_type || null,
          entity_id || null,
          metaStr,
          ip_address || null,
        ]
      );
    } catch (err) {
      console.error("❌ Failed to write MySQL access log:", err.message);
    }
  }
}
