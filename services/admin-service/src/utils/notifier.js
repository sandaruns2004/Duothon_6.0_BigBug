const { logger } = require('../config/logger');

/**
 * Sends a fire-and-forget notification to the Notification Service (/internal/notify)
 */
const sendAdminNotification = async ({ userId, title, message, type = 'SECURITY', email }) => {
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
      logger.info('🔔 Async admin governance notification dispatched:', { userId, title });
    } catch (err) {
      logger.warn('Failed to send async admin notification:', { error: err.message });
    }
  });
};

module.exports = {
  sendAdminNotification
};
