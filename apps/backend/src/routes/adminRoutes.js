import express from "express";
import {
  getDoctorList,
  approveDoctor,
  rejectDoctor,
  getSystemStats,
} from "../controllers/adminController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireRole("admin"));

router.get("/doctors", getDoctorList);
router.post("/doctors/:id/approve", approveDoctor);
router.post("/doctors/:id/reject", rejectDoctor);
router.get("/stats", getSystemStats);

export default router;
