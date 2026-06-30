import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { getGroqApiKey, getDbPass } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Patient-only RAG Q&A: runs Python script with JWT user id as patient_id.
 */
export async function patientRagChat(req, res) {
  const message = req.body?.message;
  const top_k = req.body?.top_k ?? 5;
  const patientId = req.user?.id;

  if (!patientId) {
    return res.status(401).json({ success: false, message: "Unauthorized." });
  }

  if (!message || !String(message).trim()) {
    return res.status(400).json({ success: false, message: "Message is required." });
  }

  let groqKey;
  try {
    groqKey = getGroqApiKey().trim();
  } catch {
    return res.status(500).json({
      success: false,
      message: "GROQ_API_KEY is not configured on the server.",
    });
  }

  const scriptPath = path.join(__dirname, "..", "python", "app.py");
  const pythonCmd = process.env.PYTHON_PATH || "python";
  const k = Math.min(Math.max(parseInt(String(top_k), 10) || 5, 1), 15);

  const args = [
    scriptPath,
    "--patient_id",
    String(patientId),
    "--query",
    String(message).trim(),
    "--top_k",
    String(k),
  ];

  const childEnv = {
    ...process.env,
    GROQ_API_KEY: groqKey,
    DB_PASSWORD: getDbPass(),
    // Pass patient context via env (reduces chance of leaking IDs via process args)
    PATIENT_ID: String(patientId),
  };

  const child = spawn(pythonCmd, args, {
    cwd: path.join(__dirname, ".."),
    env: childEnv,
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (d) => {
    stdout += d.toString();
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  child.on("error", (err) => {
    console.error("RAG spawn error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Failed to start AI process.",
        error: err.message,
      });
    }
  });

  child.on("close", (code) => {
    if (res.headersSent) return;
    if (stderr) console.error("[python rag stderr]", stderr);
    try {
      const trimmed = stdout.trim();
      const result = trimmed ? JSON.parse(trimmed) : {};
      if (!result.success) {
        return res.status(code === 0 ? 400 : 500).json(result);
      }
      return res.json(result);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Unexpected response from AI service.",
        preview: stdout.slice(0, 1500),
      });
    }
  });
}
