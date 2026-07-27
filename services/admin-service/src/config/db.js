const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Prisma Database Client for Admin Service (admin_db + cross-schema)
// ═══════════════════════════════════════════════════════════════════

const prisma = new PrismaClient({
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
