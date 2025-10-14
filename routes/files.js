// routes/files.js
const router = require("express").Router();
const filesController = require("../controllers/files");

router.post("/list", filesController.list);
router.post("/upload", filesController.upload);
router.post("/delete", filesController.delete);
router.post("/presign", filesController.presign);
router.post("/finalize", filesController.finalize);

module.exports = router;
