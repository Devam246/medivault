import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import fsSync from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { addRecordToBlockchain } from "../blockchain/blockchain.js";
import { authenticateToken } from "../middleware/auth.js";
import db from "../config/db.js";
import { isMongoEnabled } from "../config/mongo.js";
import { createMedicalRecord } from "../repositories/mongoRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Absolute path so uploads always land in apps/backend/uploads/ regardless of CWD
const UPLOAD_ROOT = path.resolve(__dirname, "../../uploads");
if (!fsSync.existsSync(UPLOAD_ROOT)) {
  fsSync.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(pdf|jpe?g|png|doc|docx|xlsx?)$/i;
    if (allowedExt.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error("Invalid file type. Allowed: pdf, jpg, png, doc, docx, xlsx"));
  },
});

/** Multer wrapper so errors return JSON instead of hanging */
function runUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("[UPLOAD] Multer error:", err.message);
      return res.status(400).json({
        success: false,
        message: err.message || "File upload failed",
      });
    }
    next();
  });
}

const recordsFilePath = path.resolve("records.json");

async function ensureRecordsFile() {
  try {
    await fs.access(recordsFilePath);
  } catch {
    await fs.writeFile(recordsFilePath, "[]", "utf-8");
  }
}

async function readRecords() {
  await ensureRecordsFile();
  const recordsRaw = await fs.readFile(recordsFilePath, "utf-8");
  return JSON.parse(recordsRaw);
}

async function writeRecords(records) {
  await fs.writeFile(
    recordsFilePath,
    JSON.stringify(
      records,
      (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      2
    ),
    "utf-8"
  );
}


router.post("/upload", authenticateToken, runUpload, async (req, res, next) => {
  console.log("[UPLOAD HIT]", new Date().toISOString(), {
    userId: req.user?.id,
    role: req.user?.role,
  });

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  console.log("[UPLOAD] File received:", {
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });

  const role = req.user.role;
  if (!["patient", "doctor"].includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Only patient or doctor accounts can upload medical files",
    });
  }

  const { title, type, recordDate, notes, patient_id } = req.body;

  if (!title || !type) {
    return res.status(400).json({
      success: false,
      message: "Title and type are required",
    });
  }

  if (role === "doctor" && !patient_id) {
    return res.status(400).json({
      success: false,
      message: "patient_id is required for doctor uploads",
    });
  }

  const filePath = `/uploads/${req.file.filename}`;

  try {
    const fileBuffer = await fs.readFile(req.file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    console.log("[UPLOAD] Hash generated (sha256):", fileHash);

    console.log("[UPLOAD] Calling addRecordToBlockchain (await)...");
    const chainResult = await addRecordToBlockchain(fileHash);
    console.log("[UPLOAD] Blockchain transaction success:", {
      transactionHash: chainResult.transactionHash,
      blockNumber: chainResult.blockNumber,
    });

    const records = await readRecords();
    const nextId = records.length
      ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1
      : 1;

    const jsonRecord = {
      id: nextId,
      userId: req.user.id,
      role,
      title,
      type,
      fileHash,
      filePath,
      owner: chainResult.owner,
      transactionHash: chainResult.transactionHash,
      blockNumber: chainResult.blockNumber,
      timestamp: new Date().toISOString(),
    };

    records.push(jsonRecord);
    await writeRecords(records);
    console.log("[UPLOAD] Appended to records.json, id:", nextId);

    let mysqlRecordId = null;

    if (role === "patient") {
      if (isMongoEnabled()) {
        const record = await createMedicalRecord({
          patient_id: req.user.id,
          doctor_id: null,
          title,
          type,
          record_date: recordDate || new Date().toISOString().split("T")[0],
          file_path: filePath,
          file_name: req.file.filename,
          file_hash: fileHash,
          transaction_hash: chainResult.transactionHash,
          block_number: chainResult.blockNumber,
          notes: notes || null,
          uploaded_by: "patient",
        });
        mysqlRecordId = record.id;
        console.log("[UPLOAD] Mongo row inserted (patient), id:", mysqlRecordId);
      } else {
      const [result] = await db.query(
        `INSERT INTO medical_records
          (patient_id, title, type, record_date, file_path, notes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, 'patient')`,
        [
          req.user.id,
          title,
          type,
          recordDate || new Date().toISOString().split("T")[0],
          filePath,
          notes || null,
        ]
      );
      mysqlRecordId = result.insertId;
      console.log("[UPLOAD] MySQL row inserted (patient), id:", mysqlRecordId);
      }
    } else {
      if (isMongoEnabled()) {
        const record = await createMedicalRecord({
          patient_id,
          doctor_id: req.user.id,
          title,
          type,
          record_date: recordDate || new Date().toISOString().split("T")[0],
          file_path: filePath,
          file_name: req.file.filename,
          file_hash: fileHash,
          transaction_hash: chainResult.transactionHash,
          block_number: chainResult.blockNumber,
          notes: notes || null,
          uploaded_by: "doctor",
        });
        mysqlRecordId = record.id;
        console.log("[UPLOAD] Mongo row inserted (doctor), id:", mysqlRecordId);
      } else {
      const [result] = await db.query(
        `INSERT INTO medical_records
          (patient_id, title, type, record_date, file_path, notes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, 'doctor')`,
        [
          patient_id,
          title,
          type,
          recordDate || new Date().toISOString().split("T")[0],
          filePath,
          notes || null,
        ]
      );
      mysqlRecordId = result.insertId;
      console.log("[UPLOAD] MySQL row inserted (doctor), id:", mysqlRecordId);
      }
    }

    return res.json({
      success: true,
      message: "Upload completed: file stored, blockchain confirmed, record saved",
      fileHash,
      filePath,
      filename: req.file.filename,
      transactionHash: chainResult.transactionHash,
      blockNumber: chainResult.blockNumber,
      jsonRecordId: nextId,
      mysqlRecordId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/records", async (req, res, next) => {
  try {
    const records = await readRecords();
    res.json({ success: true, records });
  } catch (error) {
    next(error);
  }
});

export default router;
