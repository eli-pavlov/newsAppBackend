const express = require("express");
const router = express.Router();
const dbController = require("../controllers/db");

router.get('/db-available', dbController.available);

module.exports = router
