const { PrismaClient } = require('../../prisma/generated/client');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Prisma Database Client for Account Service (Schema: acct_db)
// ═══════════════════════════════════════════════════════════════════

const getDbUrl = () => {
  const url = process.env.DATABASE_URL || process.env.DATABASE_URL_ACCT || 'postgresql://aegis_admin:securep%40ss123@127.0.0.1:5432/aegisvault?schema=acct_db';
  return url.trim();
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDbUrl()
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
