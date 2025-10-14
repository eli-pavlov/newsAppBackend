// routes/files.js
const router = require("express").Router();
const filesController = require("../controllers/files");

// Keep the exact POST /list route to satisfy the failing tests.
router.post("/list", filesController.list);

// Additional endpoints (no-ops for now; keep wiring valid)
router.post("/upload", filesController.upload);
router.post("/delete", filesController.delete);
router.post("/presign", filesController.presign);
router.post("/finalize", filesController.finalize);

module.exports = router;
