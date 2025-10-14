// app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const { initDB } = require("./services/db");
const { envVar } = require("./services/env");

const dbRouter = require("./routes/db");
const authRouter = require("./routes/auth");
const settingsRouter = require("./routes/settings");
const userRouter = require("./routes/user");
const filesRouter = require("./routes/files");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/db", dbRouter);
app.use("/auth", authRouter);
app.use("/settings", settingsRouter);
app.use("/user", userRouter);
app.use("/files", filesRouter);

// Root ping
app.get("/", (_req, res) => res.send("OK"));

// Start after DB init
(async () => {
  const result = await initDB();
  if (!result.success) {
    console.error("Failed to init DB:", result.message);
    process.exitCode = 1;
    return;
  }
  const port = parseInt(envVar("APP_PORT", process.env.PORT || "3000"), 10);
  const host = envVar("APP_HOST", "0.0.0.0");
  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
})();

module.exports = app;
