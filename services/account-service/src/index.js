const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const accountRoutes = require('./routes/account.routes');
const paymentRoutes = require('./routes/payment.routes');
const loanRoutes = require('./routes/loan.routes');

// ═══════════════════════════════════════════════════════════════════
// AegisVault Account Service (Port 3002)
// Handles Account Management, Balance Lookups & Atomic ACID Transfers
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3002;
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
    service: 'account-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000)
  });
});

// 5. Mount Account, Payment & Loan Routes
// Supports both /api/accounts and direct path prefixes for reverse proxy flexibility
app.use('/api/accounts', accountRoutes);
app.use('/accounts', accountRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/payments', paymentRoutes);
app.use('/api/loans', loanRoutes);
app.use('/loans', loanRoutes);
app.use('/', accountRoutes);

// 6. 404 Fallback Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Account Service Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Account Service Exception:', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error in Account Service'
  });
});

// Start Account Service Server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🏦 AegisVault Account Service running on port ${PORT}`);
  });
}

module.exports = app;
