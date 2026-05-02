import { Request, Response } from "express";
import { Log } from "../config/logger";
import { runScheduler } from "../service/scheduler";

export async function scheduleHandler(req: Request, res: Response): Promise<void> {
  await Log("backend", "info", "handler", "received request to run vehicle maintenance scheduler");
  try {
    const results = await runScheduler();
    await Log("backend", "info", "handler", "scheduler completed, sending response");
    res.json({ success: true, results });
  } catch (err) {
    await Log("backend", "error", "handler", `scheduler failed: ${err}`);
    res.status(500).json({ success: false, error: "scheduler failed" });
  }
}
