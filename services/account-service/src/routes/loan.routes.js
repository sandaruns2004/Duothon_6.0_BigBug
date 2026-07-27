const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loan.controller');
const { validate, createLoanSchema } = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// Loan Operations Routes (/api/loans)
// ═══════════════════════════════════════════════════════════════════

router.post('/apply', validate(createLoanSchema), loanController.applyLoan);
router.post('/', validate(createLoanSchema), loanController.applyLoan);
router.post('/calculate', loanController.calculateLoan);
router.get('/', loanController.listLoans);
router.get('/:id', loanController.getLoan);
router.get('/:id/schedule', loanController.getLoan);
router.get('/:id/amortization', loanController.getLoan);

module.exports = router;
