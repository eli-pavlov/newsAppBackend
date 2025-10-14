const express = require("express");
const router = express.Router();
const settingController = require("../controllers/settings");

router.get('/get', (req,res)=>settingController.getSettings(req,res));
router.post('/user', (req, res) => settingController.getUserSettings(req, res));
router.post('/set', (req, res) => settingController.saveSettings(req, res));

module.exports = router
