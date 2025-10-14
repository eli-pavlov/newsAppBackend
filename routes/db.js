const express = require("express");
const router = express.Router();
const dbController = require("../controllers/db");

router.get('/available', dbController.available);
router.get('/create', dbController.create );

module.exports = router
