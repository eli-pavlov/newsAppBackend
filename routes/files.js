// Backend — routes/files.js
//
// Express Router for File Operations
// Defines routes for file upload, delete, presign, and finalize.
// Legacy routes are retained for compatibility.
// New routes support direct S3 uploads via pre-signed URLs.
//
// Routes:
// - POST /upload: Legacy server-mediated upload.
// - POST /delete: Delete file.
// - POST /presign: Generate pre-signed URL (S3 step 1).
// - POST /finalize: Verify upload (S3 step 3).

const express = require("express");              // Express framework.
const router = express.Router();                 // Router for grouping routes.
const filesController = require("../controllers/files"); // Controller with handler functions.

// Legacy upload endpoint.
router.post('/upload', filesController.upload);  // Server handles file upload.

// Legacy delete endpoint.
router.post('/delete', filesController.delete);  // Delete by name/subFolder.

// New: Generate pre-signed URL for S3.
router.post('/presign', filesController.presign);   // Step 1 in direct upload.

// New: Verify S3 upload completion.
router.post('/finalize', filesController.finalize); // Step 3 in direct upload.

module.exports = router;                           // Export for use in main app.