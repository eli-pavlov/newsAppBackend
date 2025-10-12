// backend/routes/files.js (no changes; kept as-is for completeness)
const express = require('express');
const router = express.Router();
const controller = require('../controllers/files');

router.post('/upload', controller.upload);
router.post('/delete', controller.delete);
router.post('/presign', controller.presign);
router.post('/finalize', controller.finalize);
router.post('/delete_presign', controller.deletePresign);
router.post('/finalize_delete', controller.finalizeDelete);

module.exports = router;