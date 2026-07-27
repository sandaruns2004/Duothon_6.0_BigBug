const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

// ═══════════════════════════════════════════════════════════════════
// User Notification Routes (/api/notifications)
// ═══════════════════════════════════════════════════════════════════

router.get('/', notificationController.listNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
