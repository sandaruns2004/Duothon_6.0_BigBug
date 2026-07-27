require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const notificationRoutes = require('./routes/notification.routes');
const auditRoutes = require('./routes/audit.routes');
const internalRoutes = require('./routes/internal.routes');

// ═══════════════════════════════════════════════════════════════════
// AegisVault Notification & Audit Service (Port 3004)
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3004;

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Mount Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/internal', internalRoutes);
// Alias for reverse-proxy convenience
app.use('/api/notifications/internal', internalRoutes);

// 404 Route Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found in Notification Service`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Exception in Notification Service:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl
  });
  res.status(500).json({
    success: false,
    error: 'Internal Server Error in Notification Service'
  });
});

// Start Server if not imported as a module
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`✅ Notification & Cryptographic Audit Service running on port ${PORT}`);
  });
}

module.exports = app;
