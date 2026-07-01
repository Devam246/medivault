import { z } from "zod";

/**
 * Middleware to validate incoming request parts (body, query, params)
 * using a Zod schema. If validation fails, it intercepts the request
 * and returns a structured 400 Bad Request response.
 * Note: Zod v4 uses `err.issues` instead of `err.errors`.
 */
export const validateRequest = (schema) => async (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (err) {
    if (req.file && req.file.path) {
      try {
        const fs = await import("fs/promises");
        await fs.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error("Failed to delete uploaded file on validation error:", unlinkErr.message);
      }
    }
    if (err instanceof z.ZodError) {
      // Zod v4 uses `issues`, Zod v3 uses `errors`
      const issues = err.issues ?? err.errors ?? [];
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: issues.map((e) => ({
          field: Array.isArray(e.path) ? e.path.join(".") : String(e.path),
          message: e.message,
        })),
      });
    }
    next(err);
  }
};
