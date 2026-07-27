const Redis = require('ioredis');
const { logger } = require('./logger');

// ═══════════════════════════════════════════════════════════════════
// Redis Client Configuration for API Gateway Rate Limiter
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
  logger.info('⚡ Redis connected successfully for API Gateway Rate Limiter');
});

redisClient.on('error', (err) => {
  if (isRedisConnected) {
    logger.warn('Redis connection error in API Gateway:', { error: err.message });
  }
  isRedisConnected = false;
});

// Attempt background connect without crashing on startup failure
redisClient.connect().catch((err) => {
  logger.warn('Initial Redis connection failed — Rate Limiter will fall back to memory store until Redis is available', {
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
