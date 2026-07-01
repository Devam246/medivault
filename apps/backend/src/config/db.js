import mysql from "mysql2/promise";
import { getDbPass } from "./env.js";

let pool;

function getPool() {
  if (!pool) {
    console.log("DB connecting to:", process.env.DB_HOST);
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: getDbPass(),
      database: process.env.DB_NAME,
    });
  }
  return pool;
}

const db = {
  query(...args) {
    return getPool().query(...args);
  },
  execute(...args) {
    return getPool().execute(...args);
  },
  getConnection(...args) {
    return getPool().getConnection(...args);
  },
  end(...args) {
    if (!pool) return Promise.resolve();
    return pool.end(...args);
  },
};

export default db;
