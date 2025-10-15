const express = require("express");
const router = express.Router();
const filesController = require("../controllers/files");

// Legacy endpoints
router.post('/upload', filesController.upload);
router.post('/delete', filesController.delete);

// New presigned upload flow
router.post('/presign', filesController.presign);
router.post('/finalize', filesController.finalize);

module.exports = router
