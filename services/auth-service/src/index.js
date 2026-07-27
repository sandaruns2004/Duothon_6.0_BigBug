const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { logger, requestLogger } = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

// ═══════════════════════════════════════════════════════════════════
// AegisVault Auth Service (Port 3001)
// Handles MFA Authentication, Token Issuance, Lockout & Customer KYC
// ═══════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 3001;
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
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000)
  });
});

// 5. Mount Authentication & User Profile / KYC Routes
// Support both /api/auth and direct / prefixes for flexible API Gateway proxying
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/', authRoutes);

app.use('/api/users', userRoutes);
app.use('/users', userRoutes);

// 6. 404 Fallback Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Auth Service Route not found: ${req.method} ${req.originalUrl}`
  });
});

// 7. Global Error Handler Middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled Auth Service Exception:', {
    error: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error in Auth Service'
  });
});

// Start Auth Service Server
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`🔐 AegisVault Auth Service running on port ${PORT}`);
  });
}

module.exports = app;
