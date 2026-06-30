import { AppError } from "../utils/AppError.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err instanceof AppError ? err.status : err.statusCode || 500;
  const code = err instanceof AppError ? err.code : err.code || "INTERNAL_ERROR";
  const message = err.message || "Something went wrong";

  if (status >= 500) {
    console.error(err.stack || err);
  }

  res.status(status).json({ success: false, message, code });
}
