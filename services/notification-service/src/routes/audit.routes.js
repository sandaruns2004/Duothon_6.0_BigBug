const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');

// ═══════════════════════════════════════════════════════════════════
// Audit Log Viewer Routes (/api/audit)
// ═══════════════════════════════════════════════════════════════════

router.get('/', auditController.listAuditLogs);
router.get('/verify-chain', auditController.verifyChainEndpoint);

module.exports = router;
