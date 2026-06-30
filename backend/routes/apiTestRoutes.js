import express from "express";
import { apiHealth, getAllUsers } from "../controllers/apiTestController.js";

const router = express.Router();

router.get("/test", apiHealth);
router.get("/users", getAllUsers);

export default router;
