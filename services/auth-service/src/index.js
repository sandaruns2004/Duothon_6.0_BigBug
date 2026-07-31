const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { execSync } = require('child_process');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('../prisma/generated/client');
const { logger, requestLogger } = require('./config/logger');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const rabbitmq = require('./utils/rabbitmq');

const prisma = new PrismaClient();

const initDatabaseAndSeed = async () => {
  try {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    if (process.env.DATABASE_URL) {
      logger.info('🔄 [Auth Service] Syncing schema with database...');
      try {
        execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss`, {
          env: { ...process.env },
          stdio: 'inherit'
        });
      } catch (pushErr) {
        logger.warn('npx prisma db push failed, trying local binary...', { error: pushErr.message });
        execSync(`./node_modules/.bin/prisma db push --schema="${schemaPath}" --accept-data-loss`, {
          env: { ...process.env },
          stdio: 'inherit'
        });
      }
      logger.info('✅ [Auth Service] Schema synchronized successfully.');

      const demoEmail = 'customer1@aegisvault.com';
      const existingUser = await prisma.user.findUnique({ where: { email: demoEmail } });
      if (!existingUser) {
        logger.info('🌱 [Auth Service] Seeding demo customer...');
        const passwordHash = await bcrypt.hash('CustomerSecure2026!', 12);
        await prisma.user.create({
          data: {
            id: 'usr-customer-demo-001',
            email: demoEmail,
            phone: '+1555010001',
            nic: '199001010001',
            passwordHash,
            role: 'CUSTOMER',
            kycStatus: 'VERIFIED',
            failedAttempts: 0,
            isLocked: false
          }
        });
        logger.info('✅ [Auth Service] Demo customer seeded successfully.');
      }

      const adminEmail = 'admin@aegisvault.com';
      const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (!existingAdmin) {
        logger.info('🌱 [Auth Service] Seeding demo admin...');
        const passwordHash = await bcrypt.hash('AdminSecure2026!', 12);
        await prisma.user.create({
          data: {
            id: 'usr-admin-demo-001',
            email: adminEmail,
            phone: '+1555010002',
            nic: '199001010002',
            passwordHash,
            role: 'ADMIN',
            kycStatus: 'VERIFIED',
            failedAttempts: 0,
            isLocked: false
          }
        });
        logger.info('✅ [Auth Service] Demo admin seeded successfully.');
      }
    }
  } catch (err) {
    logger.error('❌ [Auth Service] Database initialization FAILED:', {
      error: err.message,
      stdout: err.stdout ? err.stdout.toString() : undefined,
      stderr: err.stderr ? err.stderr.toString() : undefined
    });
  }
};



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
  initDatabaseAndSeed().finally(async () => {
    try {
      await rabbitmq.connect();
    } catch (err) {
      logger.error('Failed to connect to RabbitMQ on startup', { error: err.message });
    }
    app.listen(PORT, () => {
      logger.info(`🔐 AegisVault Auth Service running on port ${PORT}`);
    });
  });
}

module.exports = app;

