const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

// ═══════════════════════════════════════════════════════════════════
// Admin Management Routes (/api/admin)
// ═══════════════════════════════════════════════════════════════════

router.get('/dashboard', adminController.getDashboard);
router.get('/users', adminController.listUsers);
router.put('/users/:id/suspend', adminController.suspendUser);
router.put('/users/:id/verify', adminController.verifyUserKyc);
router.put('/users/:id/unlock', adminController.unlockUser);
router.get('/fraud-alerts', adminController.listFraudAlerts);
router.get('/transactions', adminController.listTransactions);
router.get('/reports/daily', adminController.getDailyReports);

module.exports = router;
