const rabbitmq = require('./rabbitmq');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Async Fire-and-Forget Notification & Audit Dispatcher
// ═══════════════════════════════════════════════════════════════════

/**
 * Asynchronously dispatches fire-and-forget notifications and audit events via RabbitMQ
 */
const dispatchAsyncNotifications = async ({ transaction, fraudEvaluation, userEmail }) => {
  // Fire-and-forget execution without blocking the API response
  setImmediate(async () => {
    try {
      // 1. Dispatch notification command (direct exchange)
      try {
        await rabbitmq.publishCommand('notify.send', {
          userId: transaction.userId,
          to: userEmail || 'customer@aegisvault.com',
          type: transaction.fraudFlag ? 'FRAUD_ALERT' : 'TRANSACTION_ALERT',
          title: transaction.fraudFlag 
            ? `🚨 Fraud Velocity Alert: LKR ${Number(transaction.amount).toLocaleString()}` 
            : `⚡ Transaction Alert: LKR ${Number(transaction.amount).toLocaleString()}`,
          message: `Transfer of LKR ${Number(transaction.amount).toLocaleString()} (${transaction.status}) - Ref: ${transaction.referenceNumber}`,
          subject: `Transaction Alert: LKR ${Number(transaction.amount).toLocaleString()}`,
          transactionId: transaction.id,
          referenceNumber: transaction.referenceNumber,
          amount: Number(transaction.amount),
          currency: transaction.currency,
          status: transaction.status,
          fraudFlag: transaction.fraudFlag,
          timestamp: transaction.createdAt
        });
      } catch (amqpErr) {
        logger.warn('RabbitMQ publish failed, using HTTP /internal/notify fallback on Azure:', { error: amqpErr.message });
        const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';
        await fetch(`${NOTIF_URL}/internal/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: transaction.userId ? String(transaction.userId) : null,
            to: userEmail || 'customer@aegisvault.com',
            title: transaction.fraudFlag 
              ? `🚨 Fraud Velocity Alert: LKR ${Number(transaction.amount).toLocaleString()}` 
              : `⚡ Transaction Alert: LKR ${Number(transaction.amount).toLocaleString()}`,
            message: `Transfer of LKR ${Number(transaction.amount).toLocaleString()} (${transaction.status}) - Ref: ${transaction.referenceNumber}`,
            type: transaction.fraudFlag ? 'FRAUD_ALERT' : 'TRANSACTION_ALERT',
            channel: 'EMAIL'
          })
        });
      }

      // 2. Dispatch audit log event (topic exchange)
      await rabbitmq.publishEvent('audit.log', {
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
