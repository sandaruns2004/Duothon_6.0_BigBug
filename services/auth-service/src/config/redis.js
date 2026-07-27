const Redis = require('ioredis');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Redis Client Configuration for Auth Service (MFA OTP Caching)
// ═══════════════════════════════════════════════════════════════════

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let isRedisConnected = false;

const redisClient = new Redis(redisUrl, {
  retryStrategy(times) {
    const delay = Math.min(times * 500, 5000);
    return delay;
  },
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true
});

redisClient.on('connect', () => {
  isRedisConnected = true;
  logger.info('⚡ Redis connected successfully for Auth Service OTP cache');
});

redisClient.on('error', (err) => {
  if (isRedisConnected) {
    logger.warn('Redis connection error in Auth Service:', { error: err.message });
  }
  isRedisConnected = false;
});

redisClient.connect().catch((err) => {
  logger.warn('Initial Redis connection failed in Auth Service — OTP caching will fall back to database storage', {
    error: err.message
  });
});

const getRedisClient = () => redisClient;
const checkRedisConnected = () => isRedisConnected;

module.exports = {
  redisClient,
  getRedisClient,
  checkRedisConnected
};
