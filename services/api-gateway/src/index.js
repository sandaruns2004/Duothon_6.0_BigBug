const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const { publicRateLimiter, authenticatedRateLimiter } = require('./middleware/rateLimiter');
const { jwtAuthMiddleware } = require('./middleware/jwtAuth');
const { setupProxies } = require('./middleware/proxy');

// ═══════════════════════════════════════════════════════════════════
// AegisVault API Gateway (Port 3000)
// Enterprise Reverse Proxy, JWT Auth, Rate Limiter & Security Gateway
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3000;
const START_TIME = Date.now();

// 1. Core Security & CORS Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(helmet());

// 2. Winston Request Logger Middleware (Structured JSON Logs)
app.use(requestLogger);

// 3. Body Parser for JSON Requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Service Health Check Endpoint (Bypasses JWT and Rate Limiting)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000)
  });
});

// 5. Rate Limiting Middleware (Backed by Redis)
// Apply public 20 req/min limit to public auth endpoints
app.use('/api/auth', publicRateLimiter);
// Apply authenticated 100 req/min limit to all general /api endpoints
app.use('/api', authenticatedRateLimiter);

// 6. JWT Authentication & Whitelisting Middleware
app.use(jwtAuthMiddleware);

// 7. Microservice Reverse Proxy Routing
setupProxies(app);

// 8. Fallback 404 Handler for Unmatched Routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 9. Global Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled API Gateway Exception:', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error in API Gateway'
  });
});

// Start API Gateway Server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🛡️ AegisVault API Gateway running on port ${PORT}`);
  });
}

module.exports = app;
