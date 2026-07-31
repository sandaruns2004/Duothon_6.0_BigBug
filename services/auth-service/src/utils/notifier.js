const { logger } = require('../config/logger');

/**
 * Sends an async fire-and-forget notification to Notification Service (/internal/notify)
 */
const sendAuthNotification = async ({ userId, title, message, type = 'SECURITY', email }) => {
  setImmediate(async () => {
    try {
      const NOTIF_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';
      await fetch(`${NOTIF_URL}/internal/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId ? String(userId) : null,
          to: email || 'customer@aegisvault.com',
          title,
          message,
          type,
          channel: 'EMAIL'
        })
      });
      logger.info('🔔 Async auth notification dispatched:', { userId, title });
    } catch (err) {
      logger.warn('Failed to send async auth notification:', { error: err.message });
    }
  });
};

module.exports = {
  sendAuthNotification
};
