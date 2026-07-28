const { PrismaClient } = require('../../prisma/generated/client');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Prisma Database Client for Transaction Service (Schema: txn_db)
// ═══════════════════════════════════════════════════════════════════

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DATABASE_URL_TXN || 'postgresql://aegis_admin:securep%40ss123@127.0.0.1:5432/aegisvault?schema=txn_db'
    }
  },
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

prisma.$on('error', (e) => {
  logger.error('Prisma Database Error', { error: e.message, target: e.target });
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma Database Warning', { message: e.message });
});

module.exports = { prisma };
