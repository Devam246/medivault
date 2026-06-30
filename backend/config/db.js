import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
console.log("ENV CHECK:");
console.log("HOST:", process.env.DB_HOST);
console.log("USER:", process.env.DB_USER);
console.log("PASS:", process.env.DB_PASS);
console.log("DB:", process.env.DB_NAME);
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

export default db;
