const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const auditController = require('../controllers/audit.controller');

// ═══════════════════════════════════════════════════════════════════
// Internal Container-to-Container Routes (/internal)
// ═══════════════════════════════════════════════════════════════════

router.post('/notify', notificationController.internalNotify);
router.post('/email', notificationController.internalEmail);
router.post('/audit', auditController.internalAudit);

module.exports = router;
