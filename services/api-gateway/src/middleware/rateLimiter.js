const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient, checkRedisConnected } = require('../config/redis');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// Express Rate Limiter with Redis Backing Store (Graceful Fallback)
// - Public Routes: 20 req/min
// - Authenticated Routes: 100 req/min
// ═══════════════════════════════════════════════════════════════════

/**
 * Helper to generate RedisStore if Redis is connected, else return undefined (in-memory default store)
 */
const getStore = (prefix) => {
  try {
    if (checkRedisConnected()) {
      return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `aegis_rl_${prefix}:`
      });
    }
  } catch (err) {
    logger.warn('Failed to initialize Redis store for rate limiter, falling back to in-memory store', {
      error: err.message
    });
  }
  return undefined;
};

/**
 * Rate Limiter for Public Endpoints (e.g. /api/auth/login, /api/auth/register)
 * Limit: 20 requests per minute per IP
 */
const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 1 minute.',
    retryAfterSeconds: 60
  },
  store: getStore('public'),
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
  }
});

/**
 * Rate Limiter for Authenticated Endpoints (e.g. /api/accounts, /api/transactions)
 * Limit: 100 requests per minute per Authenticated User ID or IP
 */
const authenticatedRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded for authenticated session. Maximum 100 requests per minute allowed.',
    retryAfterSeconds: 60
  },
  store: getStore('auth'),
  keyGenerator: (req) => {
    // If authenticated, rate limit per user ID; otherwise per IP
    if (req.user && (req.user.sub || req.user.id || req.user.userId)) {
      return `user:${req.user.sub || req.user.id || req.user.userId}`;
    }
    return req.ip || req.headers['x-forwarded-for'] || 'unknown-ip';
  }
});

module.exports = {
  publicRateLimiter,
  authenticatedRateLimiter
};
