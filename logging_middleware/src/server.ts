import express, { Request, Response } from "express";
import { Log } from "./index";

const app = express();
const PORT = 3002;

app.use(express.json());

app.post("/log", async (req: Request, res: Response): Promise<void> => {
  const { stack, level, package: pkg, message } = req.body;
  try {
    await Log(stack, level, pkg, message);
    res.json({ success: true, message: "log sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: `${err}` });
  }
});

app.listen(PORT, () => {
  process.stdout.write(`logging middleware server running on port ${PORT}\n`);
});
