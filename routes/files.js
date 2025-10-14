const express = require("express");
const router = express.Router();
const filesController = require("../controllers/files");

router.post('/upload', filesController.upload);
router.post('/delete', filesController.delete);

module.exports = router
