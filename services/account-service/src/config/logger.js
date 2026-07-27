const winston = require('winston');

// ═══════════════════════════════════════════════════════════════════
// Winston Structured JSON Logger for Account Service
// ═══════════════════════════════════════════════════════════════════

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'account-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('HTTP Request', {
      method,
      path: originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip
    });
  });

  next();
};

module.exports = { logger, requestLogger };
