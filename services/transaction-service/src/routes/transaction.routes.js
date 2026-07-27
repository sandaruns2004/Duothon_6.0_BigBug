const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const { validate, transferSchema, externalTransferSchema } = require('../utils/validation');

// ═══════════════════════════════════════════════════════════════════
// Transaction Routes (/api/transactions)
// ═══════════════════════════════════════════════════════════════════

router.post('/transfer', validate(transferSchema), transactionController.transfer);
router.post('/external-transfer', validate(externalTransferSchema), transactionController.externalTransfer);
router.get('/', transactionController.listTransactions);
router.get('/:id', transactionController.getTransaction);
router.get('/:id/receipt', transactionController.getReceipt);

module.exports = router;
