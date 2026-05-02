import { Request, Response } from "express";
import { Log } from "../config/logger";
import { getToken } from "../config/auth";
import { getTopN, Notification } from "../service/priority";

const NOTIFICATIONS_URL = "http://20.207.122.201/evaluation-service/notifications";

export async function priorityInboxHandler(req: Request, res: Response): Promise<void> {
  await Log("backend", "info", "handler", "received request for priority inbox");

  try {
    const n = parseInt(req.query.n as string) || 10;
    const token = await getToken();

    const response = await fetch(NOTIFICATIONS_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      await Log("backend", "error", "handler", "failed to fetch notifications from test server");
      res.status(502).json({ success: false, error: "failed to fetch notifications" });
      return;
    }

    const { notifications } = (await response.json()) as { notifications: Notification[] };

    await Log("backend", "info", "service", `fetched ${notifications.length} notifications, computing top ${n}`);

    const top = getTopN(notifications, n);

    await Log("backend", "info", "handler", `returning top ${top.length} priority notifications`);

    res.json({ success: true, count: top.length, notifications: top });
  } catch (err) {
    await Log("backend", "error", "handler", `priority inbox failed: ${err}`);
    res.status(500).json({ success: false, error: "internal server error" });
  }
}
