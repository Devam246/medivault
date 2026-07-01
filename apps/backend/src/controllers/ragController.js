import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { getGroqApiKey, getDbPass } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAG_SERVICE_DIR = path.join(__dirname, "..", "..", "..", "rag-service");

export async function patientRagChat(req, res, next) {
  try {
    const message = req.body?.message;
    const top_k = req.body?.top_k ?? 5;
    const patientId = req.user?.id;

    if (!patientId) {
      throw new AppError("Unauthorized.", 401, "UNAUTHORIZED");
    }
    if (!message || !String(message).trim()) {
      throw new AppError("Message is required.", 400, "VALIDATION_ERROR");
    }

    let groqKey;
    try {
      groqKey = getGroqApiKey().trim();
    } catch {
      throw new AppError("GROQ_API_KEY is not configured on the server.", 500, "CONFIG_ERROR");
    }

    const scriptPath = path.join(RAG_SERVICE_DIR, "app.py");
    const pythonCmd = process.env.PYTHON_PATH || "python";
    const k = Math.min(Math.max(parseInt(String(top_k), 10) || 5, 1), 15);

    const args = [
      scriptPath,
      "--patient_id", String(patientId),
      "--query", String(message).trim(),
      "--top_k", String(k),
    ];

    const childEnv = {
      ...process.env,
      GROQ_API_KEY: groqKey,
      DB_PASSWORD: getDbPass(),
      PATIENT_ID: String(patientId),
    };

    const child = spawn(pythonCmd, args, { cwd: RAG_SERVICE_DIR, env: childEnv });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      console.error(`[RAG TIMEOUT] RAG subprocess timed out after 30 seconds, killing pid ${child.pid}`);
      child.kill("SIGKILL");
    }, 30000);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => {
      clearTimeout(timeoutId);
      next(err);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (res.headersSent) return;

      if (timedOut) {
        return next(new AppError("RAG service request timed out.", 504, "TIMEOUT_ERROR"));
      }

      if (stderr) console.error("[python rag stderr]", stderr);
      try {
        const trimmed = stdout.trim();
        const result = trimmed ? JSON.parse(trimmed) : {};
        if (!result.success) {
          return res.status(code === 0 ? 400 : 500).json(result);
        }
        return res.json(result);
      } catch {
        return next(new AppError("Unexpected response from AI service.", 500, "RAG_ERROR"));
      }
    });
  } catch (err) {
    next(err);
  }
}
