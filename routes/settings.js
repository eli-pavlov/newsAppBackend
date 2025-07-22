const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settings");

router.get('/settings', settingController.getSettings);
router.post('/settings', settingController.saveSettings);

module.exports = router
