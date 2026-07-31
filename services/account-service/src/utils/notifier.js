const { logger } = require('../config/logger');

const getNotificationServiceUrls = () => {
  const urls = [
    process.env.NOTIFICATION_SERVICE_URL,
    'http://notification-service:3004',
    'http://localhost:3004',
    'http://127.0.0.1:3004'
  ];
  return Array.from(new Set(urls.filter(Boolean)));
};

/**
 * Sends a fire-and-forget notification to the Notification Service (/internal/notify)
 * Tries fallback URLs if network or host resolution fails
 */
const sendAccountNotification = async ({ userId, title, message, type = 'TRANSACTION', email }) => {
  setImmediate(async () => {
    const urls = getNotificationServiceUrls();
    let lastError = null;

    for (const baseUrl of urls) {
      try {
        const res = await fetch(`${baseUrl}/internal/notify`, {
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

        if (res.ok) {
          logger.info('🔔 Async account notification dispatched:', { userId, title, baseUrl });
          return;
        }
      } catch (err) {
        lastError = err;
        // Try next URL on network failure
      }
    }
    logger.warn('Failed to send async account notification across all fallback URLs:', { error: lastError ? lastError.message : 'Unknown error' });
  });
};

module.exports = {
  sendAccountNotification
};
