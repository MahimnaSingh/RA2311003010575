import { Router } from "express";
import { priorityInboxHandler } from "../handler/notifications";

const router = Router();

router.get("/notifications/priority", priorityInboxHandler);

export default router;
