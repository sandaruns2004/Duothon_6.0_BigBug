const winston = require('winston');

// ═══════════════════════════════════════════════════════════════════
// Winston Structured JSON Logger for API Gateway
// ═══════════════════════════════════════════════════════════════════

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

/**
 * Express Middleware for logging incoming HTTP requests in structured JSON format
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip, headers } = req;
  const userAgent = headers['user-agent'] || 'unknown';

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const statusCode = res.statusCode;
    const logData = {
      method,
      path: originalUrl,
      statusCode,
      durationMs,
      ip,
      userAgent,
      userId: req.user ? req.user.sub || req.user.id : 'anonymous',
      userRole: req.user ? req.user.role : 'unauthenticated'
    };

    if (statusCode >= 500) {
      logger.error('HTTP Server Error', logData);
    } else if (statusCode >= 400) {
      logger.warn('HTTP Client Error', logData);
    } else {
      logger.info('HTTP Request Completed', logData);
    }
  });

  next();
};

module.exports = { logger, requestLogger };
