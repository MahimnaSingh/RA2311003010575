import express from "express";
import router from "./route/index";
import { Log } from "./config/logger";

const app = express();
const PORT = 3001;

app.use(express.json());
app.use("/api", router);

app.listen(PORT, async () => {
  await Log("backend", "info", "config", `notification service started on port ${PORT}`);
});
