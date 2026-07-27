const axios = require('axios');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Async Fire-and-Forget Notification & Audit Dispatcher
// ═══════════════════════════════════════════════════════════════════

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';

/**
 * Asynchronously dispatches fire-and-forget notifications and audit events to Notification Service
 */
const dispatchAsyncNotifications = async ({ transaction, fraudEvaluation, userEmail }) => {
  // Fire-and-forget execution without blocking the API response
  setImmediate(async () => {
    try {
      // 1. Dispatch notification event
      const notifyUrl = `${NOTIFICATION_SERVICE_URL}/internal/notify`;
      axios.post(notifyUrl, {
        to: userEmail || 'customer@aegisvault.com',
        type: 'TRANSACTION_ALERT',
        subject: `Transaction Alert: LKR ${Number(transaction.amount).toLocaleString()}`,
        transactionId: transaction.id,
        referenceNumber: transaction.referenceNumber,
        amount: Number(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        fraudFlag: transaction.fraudFlag,
        timestamp: transaction.createdAt
      }, { timeout: 2000 }).catch((e) => {
        logger.debug('Notification service /internal/notify unreachable:', { error: e.message });
      });

      // 2. Dispatch audit log event
      const auditUrl = `${NOTIFICATION_SERVICE_URL}/internal/audit`;
      axios.post(auditUrl, {
        eventType: 'TRANSACTION_AUDIT',
        service: 'transaction-service',
        transactionId: transaction.id,
        referenceNumber: transaction.referenceNumber,
        fromAccountId: transaction.fromAccountId,
        toAccountId: transaction.toAccountId,
        amount: Number(transaction.amount),
        status: transaction.status,
        fraudFlag: transaction.fraudFlag,
        riskScore: fraudEvaluation.totalRiskScore,
        triggeredRules: fraudEvaluation.triggeredRules,
        timestamp: new Date().toISOString()
      }, { timeout: 2000 }).catch((e) => {
        logger.debug('Notification service /internal/audit unreachable:', { error: e.message });
      });

      if (transaction.fraudFlag) {
        logger.warn('🔔 Async fraud alert dispatched to Notification & Audit service:', {
          referenceNumber: transaction.referenceNumber,
          riskScore: fraudEvaluation.totalRiskScore
        });
      }
    } catch (err) {
      logger.warn('Failed to dispatch async notifications:', { error: err.message });
    }
  });
};

module.exports = {
  dispatchAsyncNotifications
};
