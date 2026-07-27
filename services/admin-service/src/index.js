require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const adminRoutes = require('./routes/admin.routes');

// ═══════════════════════════════════════════════════════════════════
// AegisVault Admin Governance & Metrics Service (Port 3005)
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3005;

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'admin-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
});

// Mount Routes
app.use('/api/admin', adminRoutes);
app.use('/', adminRoutes);

// 404 Route Not Found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found in Admin Service`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('Unhandled Exception in Admin Service:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl
  });
  res.status(500).json({
    success: false,
    error: 'Internal Server Error in Admin Service'
  });
});

// Start Server if not imported as a module
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`✅ Admin Service running on port ${PORT}`);
  });
}

module.exports = app;
