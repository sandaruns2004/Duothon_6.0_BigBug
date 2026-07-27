const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const { validate, billPaymentSchema } = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// Payment Operations Routes (/api/payments)
// ═══════════════════════════════════════════════════════════════════

router.post('/bill', validate(billPaymentSchema), accountController.payBill);

module.exports = router;
