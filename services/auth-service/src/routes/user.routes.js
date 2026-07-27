const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const {
  validate,
  updateProfileSchema,
  kycUploadSchema
} = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// User Profile & KYC Routes (/api/users)
// ═══════════════════════════════════════════════════════════════════

router.get('/profile', userController.getProfile);
router.put('/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/kyc', validate(kycUploadSchema), userController.uploadKyc);

module.exports = router;
