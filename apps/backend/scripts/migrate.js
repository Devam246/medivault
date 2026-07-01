import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function main() {
  const connection = await db.getConnection();

  try {
    await ensureMigrationTable(connection);

    const [appliedRows] = await connection.query(
      "SELECT filename FROM schema_migrations"
    );
    const applied = new Set(appliedRows.map((row) => row.filename));

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip ${file}`);
        continue;
      }

      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, "utf-8");
      const statements = splitSql(sql);

      console.log(`[migrate] apply ${file}`);
      await connection.beginTransaction();
      try {
        for (const statement of statements) {
          await connection.query(statement);
        }
        await connection.query(
          "INSERT INTO schema_migrations (filename) VALUES (?)",
          [file]
        );
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      }
    }

    console.log("[migrate] complete");
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err.message);
  process.exit(1);
});
