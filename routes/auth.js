const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth");
const authMiddleware = require('../middleware/authToken')

router.get('/verify', authMiddleware.verifyAuthToken, authController.verify);
router.post('/login', authController.login);

module.exports = router
