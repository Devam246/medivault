import mysql from "mysql2/promise";
import { getDbPass } from "./env.js";

console.log("DB connecting to:", process.env.DB_HOST);
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: getDbPass(),
  database: process.env.DB_NAME
});

export default db;

