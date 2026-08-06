const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const {
  validate,
  createAccountSchema,
  executeTransferSchema,
  billPaymentSchema,
  debitCreditSchema
} = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// Bank Account Routes (/api/accounts)
// ═══════════════════════════════════════════════════════════════════

router.post('/', validate(createAccountSchema), accountController.createAccount);
router.get('/', accountController.listAccounts);
router.get('/:id/balance', accountController.getBalance);
router.post('/execute-transfer', validate(executeTransferSchema), accountController.executeTransfer);
router.post('/bill-payment', validate(billPaymentSchema), accountController.payBill);
router.post('/bill', validate(billPaymentSchema), accountController.payBill);
router.post('/debit', validate(debitCreditSchema), accountController.debitAccount);
router.post('/credit', validate(debitCreditSchema), accountController.creditAccount);

module.exports = router;
