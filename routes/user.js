// routes/user.js
const router = require("express").Router();
router.get("/me", (_req, res) => res.json({ id: 1, name: "Test User" }));
module.exports = router;
