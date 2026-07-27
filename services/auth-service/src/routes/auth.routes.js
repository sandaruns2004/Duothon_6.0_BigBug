const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {
  validate,
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshTokenSchema
} = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// Auth Routes (/api/auth)
// ═══════════════════════════════════════════════════════════════════

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/verify-otp', validate(verifyOtpSchema), authController.verifyOtp);
router.post('/refresh', validate(refreshTokenSchema), authController.refreshToken);

module.exports = router;
