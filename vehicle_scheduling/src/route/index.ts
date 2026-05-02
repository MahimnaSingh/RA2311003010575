import { Router } from "express";
import { scheduleHandler } from "../handler/schedule";

const router = Router();

router.get("/schedule", scheduleHandler);

export default router;
