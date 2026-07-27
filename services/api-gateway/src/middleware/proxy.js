const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// HTTP Reverse Proxy Routing for AegisVault Microservices
// ═══════════════════════════════════════════════════════════════════

const SERVICES = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  ACCOUNT: process.env.ACCOUNT_SERVICE_URL || 'http://account-service:3002',
  TRANSACTION: process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:3003',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004',
  ADMIN: process.env.ADMIN_SERVICE_URL || 'http://admin-service:3005'
};

/**
 * Creates a configured reverse proxy middleware for a target microservice
 */
const createServiceProxy = (targetUrl, serviceName) => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    xfwd: true,
    on: {
      proxyReq: (proxyReq, req, res) => {
        // Forward injected user identity headers to downstream service
        if (req.headers['x-user-id']) {
          proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
        }
        if (req.headers['x-user-role']) {
          proxyReq.setHeader('x-user-role', req.headers['x-user-role']);
        }
        if (req.headers['x-user-email']) {
          proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
        }

        // Apply fixRequestBody so parsed JSON bodies stream correctly to downstream proxy
        fixRequestBody(proxyReq, req);
      },
      error: (err, req, res) => {
        logger.error(`Proxy Error: Failed to reach ${serviceName}`, {
          targetUrl,
          path: req.originalUrl,
          error: err.message
        });

        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            error: `Service Unavailable: The ${serviceName} is currently unreachable. Please try again shortly.`,
            service: serviceName
          });
        }
      }
    }
  });
};

/**
 * Mounts all microservice proxy routes on the Express API Gateway application
 */
const setupProxies = (app) => {
  // Auth Service (Port 3001)
  app.use('/api/auth', createServiceProxy(SERVICES.AUTH, 'auth-service'));
  app.use('/api/users', createServiceProxy(SERVICES.AUTH, 'auth-service'));

  // Account Service (Port 3002) - handles accounts, payments, and loans
  app.use('/api/accounts', createServiceProxy(SERVICES.ACCOUNT, 'account-service'));
  app.use('/api/payments', createServiceProxy(SERVICES.ACCOUNT, 'account-service'));
  app.use('/api/loans', createServiceProxy(SERVICES.ACCOUNT, 'account-service'));

  // Transaction Service (Port 3003)
  app.use('/api/transactions', createServiceProxy(SERVICES.TRANSACTION, 'transaction-service'));

  // Notification Service (Port 3004) - handles notifications and audit trail view
  app.use('/api/notifications', createServiceProxy(SERVICES.NOTIFICATION, 'notification-service'));
  app.use('/api/audit', createServiceProxy(SERVICES.NOTIFICATION, 'notification-service'));

  // Admin Service (Port 3005)
  app.use('/api/admin', createServiceProxy(SERVICES.ADMIN, 'admin-service'));

  logger.info('🔗 API Gateway microservice proxy routes configured successfully');
};

module.exports = {
  setupProxies,
  SERVICES
};
