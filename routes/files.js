// backend/routes/files.js (Fixed: Consistent camelCase for method names)
const express = require('express');
const router = express.Router();
const controller = require('../controllers/files');

router.post('/upload', controller.upload);
router.post('/delete', controller.delete);
router.post('/presign', controller.presign);
router.post('/finalize', controller.finalize);
router.post('/deletePresign', controller.deletePresign); // Fixed: camelCase match
router.post('/finalizeDelete', controller.finalizeDelete); // Fixed: camelCase match
// New: return existing uploaded movies (merges legacy + per-user)
router.post('/list', filesController.list)

module.exports = router;