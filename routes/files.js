const express = require('express');
const filesController = require('../controllers/files');
const authMiddleware = require('../middleware/authToken');
const router = express.Router();

router.post('/presigned-url', authMiddleware.verifyAuthToken, filesController.generatePresignedUrl);
router.post('/delete', authMiddleware.verifyAuthToken, filesController.delete);
router.post('/confirm', authMiddleware.verifyAuthToken, filesController.confirmUpload);  // New endpoint

module.exports = router;