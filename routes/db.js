// routes/db.js
const router = require("express").Router();
const { healthCheck } = require("../services/db");

router.get("/available", async (_req, res) => {
  const status = await healthCheck();
  if (status.ok) res.json({ ok: true });
  else res.status(500).json({ ok: false, error: status.error });
});

module.exports = router;
