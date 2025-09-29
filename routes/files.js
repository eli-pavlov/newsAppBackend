// routes/files.js
const express = require('express');
const router = express.Router();
const filesController = require('../controllers/files');
const authMiddleware = require('../middleware/authToken');

router.post('/presigned-url', authMiddleware.verifyAuthToken, filesController.generatePresignedUrl);
router.post('/delete', authMiddleware.verifyAuthToken, filesController.delete);

module.exports = router;
