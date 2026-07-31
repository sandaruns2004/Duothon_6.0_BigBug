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
router.post('/pay', loanController.payInstallment);
router.post('/:id/pay', loanController.payInstallment);
router.put('/:id/approve', loanController.approveLoan);
router.get('/', loanController.listLoans);

router.get('/internal/pending', loanController.getInternalPendingLoans);
router.put('/internal/:id/approve', loanController.approveInternalLoan);

router.get('/:id', loanController.getLoan);
router.get('/:id/schedule', loanController.getLoan);
router.get('/:id/amortization', loanController.getLoan);

module.exports = router;
