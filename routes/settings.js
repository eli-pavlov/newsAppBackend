const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settings");

router.get('/get', (req,res)=>settingController.getSettings(req,res));
router.post('/user', settingController.getUserSettings);
router.post('/set', settingController.saveSettings);

module.exports = router
