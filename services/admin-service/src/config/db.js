const { PrismaClient } = require('../../prisma/generated/client');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Prisma Database Client for Admin Service (admin_db + cross-schema)
// ═══════════════════════════════════════════════════════════════════

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DATABASE_URL_ADMIN || 'postgresql://aegis_admin:securep%40ss123@127.0.0.1:5433/aegisvault?schema=admin_db'
    }
  },
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

prisma.$on('error', (e) => {
  logger.error('Prisma Database Error in Admin Service', { error: e.message, target: e.target });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Database Warning in Admin Service', { message: e.message });
});

module.exports = { prisma };
