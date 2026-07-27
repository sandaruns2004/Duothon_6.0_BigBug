const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const transactionRoutes = require('./routes/transaction.routes');

// ═══════════════════════════════════════════════════════════════════
// AegisVault Transaction Service (Port 3003)
// Handles Transfers, Rule-Based Fraud Detection & Verifiable Receipts
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3003;
const START_TIME = Date.now();

// 1. Core Security & CORS Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-user-email']
}));

app.use(helmet());

// 2. Winston Request Logger Middleware
app.use(requestLogger);

// 3. JSON & URL-Encoded Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'transaction-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000)
  });
});

// 5. Mount Transaction Routes
// Supports both /api/transactions and direct path prefixes for reverse proxy flexibility
app.use('/api/transactions', transactionRoutes);
app.use('/transactions', transactionRoutes);
app.use('/', transactionRoutes);

// 6. 404 Fallback Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Transaction Service Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Transaction Service Exception:', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error in Transaction Service'
  });
});

// Start Transaction Service Server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`💸 AegisVault Transaction Service running on port ${PORT}`);
  });
}

module.exports = app;
