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
import { validateRequest } from "../middleware/validate.js";
import { uploadFileSchema } from "../validators/fileValidator.js";

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


import { updateMedicalRecordBlockchain } from "../repositories/medicalRecordRepository.js";
import { logAccess } from "../repositories/accessLogRepository.js";

router.post("/upload", authenticateToken, runUpload, validateRequest(uploadFileSchema), async (req, res, next) => {
  console.log("[UPLOAD HIT]", new Date().toISOString(), {
    userId: req.user?.id,
    role: req.user?.role,
  });

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const role = req.user.role;
  if (!["patient", "doctor"].includes(role)) {
    await fs.unlink(req.file.path).catch(() => {});
    return res.status(403).json({
      success: false,
      message: "Only patient or doctor accounts can upload medical files",
    });
  }

  const { title, type, recordDate, notes, patient_id } = req.body;
  const filePath = `/uploads/${req.file.filename}`;
  const actualPatientId = role === "patient" ? req.user.id : patient_id;
  const actualDoctorId = role === "doctor" ? req.user.id : null;
  const dbRecordDate = recordDate || new Date().toISOString().split("T")[0];

  let mysqlConnection = null;
  let jsonRecordsRevert = null;

  try {
    const fileBuffer = await fs.readFile(req.file.path);
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    console.log("[UPLOAD] Hash generated (sha256):", fileHash);

    // Save to records.json first
    const records = await readRecords();
    const nextId = records.length ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1;
    const jsonRecord = {
      id: nextId,
      userId: req.user.id,
      role,
      title,
      type,
      fileHash,
      filePath,
      owner: "pending",
      transactionHash: "pending",
      blockNumber: "pending",
      timestamp: new Date().toISOString(),
    };
    records.push(jsonRecord);
    await writeRecords(records);
    
    // Setup revert for json
    jsonRecordsRevert = async () => {
      const current = await readRecords();
      await writeRecords(current.filter(r => r.id !== nextId));
    };

    let recordId = null;

    if (isMongoEnabled()) {
      // MongoDB approach
      const record = await createMedicalRecord({
        patient_id: actualPatientId,
        doctor_id: actualDoctorId,
        title,
        type,
        record_date: dbRecordDate,
        file_path: filePath,
        file_name: req.file.filename,
        file_hash: fileHash,
        transaction_hash: "pending",
        block_number: null,
        notes: notes || null,
        uploaded_by: role,
      });
      recordId = record.id;
    } else {
      // MySQL Transaction
      mysqlConnection = await db.getConnection();
      await mysqlConnection.beginTransaction();
      
      const [result] = await mysqlConnection.query(
        `INSERT INTO medical_records 
          (patient_id, doctor_id, title, type, record_date, file_path, file_name, file_hash, transaction_hash, block_number, notes, uploaded_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actualPatientId,
          actualDoctorId,
          title,
          type,
          dbRecordDate,
          filePath,
          req.file.filename,
          fileHash,
          "pending",
          null,
          notes || null,
          role,
        ]
      );
      recordId = result.insertId;
      await mysqlConnection.commit();
      mysqlConnection.release();
      mysqlConnection = null;
    }

    // Background Async Blockchain Anchoring
    setTimeout(async () => {
      try {
        console.log(`[BACKGROUND] Anchoring fileHash: ${fileHash} to blockchain...`);
        const chainResult = await addRecordToBlockchain(fileHash);
        console.log(`[BACKGROUND] Anchored fileHash: ${fileHash}. Tx: ${chainResult.transactionHash}`);

        // Update DB
        await updateMedicalRecordBlockchain(recordId, chainResult.transactionHash, chainResult.blockNumber);

        // Update JSON
        const updatedRecords = await readRecords();
        const rec = updatedRecords.find(r => r.id === nextId);
        if (rec) {
          rec.transactionHash = chainResult.transactionHash;
          rec.blockNumber = chainResult.blockNumber;
          rec.owner = chainResult.owner;
          await writeRecords(updatedRecords);
        }
      } catch (err) {
        console.error(`[BACKGROUND] Blockchain anchoring failed for fileHash: ${fileHash}`, err);
      }
    }, 0);

    // Audit Log
    await logAccess({
      actor_user_id: req.user.id,
      patient_id: actualPatientId,
      action: "UPLOAD_MEDICAL_RECORD",
      entity_type: "medical_records",
      entity_id: recordId,
      metadata: { fileHash, type, role },
      ip_address: req.ip,
    });

    return res.json({
      success: true,
      message: "Upload completed: file stored, blockchain confirming in background, record saved",
      fileHash,
      filePath,
      filename: req.file.filename,
      jsonRecordId: nextId,
      mysqlRecordId: recordId,
    });

  } catch (error) {
    console.error("[UPLOAD] Error occurred, cleaning up...", error.message);
    if (mysqlConnection) {
      await mysqlConnection.rollback();
      mysqlConnection.release();
    }
    if (jsonRecordsRevert) {
      await jsonRecordsRevert().catch(e => console.error("JSON revert failed", e));
    }
    await fs.unlink(req.file.path).catch(e => console.error("File deletion failed", e));
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
