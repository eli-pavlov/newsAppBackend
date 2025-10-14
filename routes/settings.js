// routes/settings.js
const router = require("express").Router();
const settingsController = require("../controllers/settings");

router.get("/", settingsController.get);
router.post("/", settingsController.update);

module.exports = router;
