const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Prisma Database Client for Auth Service (Schema: auth_db)
// ═══════════════════════════════════════════════════════════════════

const prisma = new PrismaClient({
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
