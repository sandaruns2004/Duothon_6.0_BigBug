const jwt = require('jsonwebtoken');
const { logger } = require('../config/logger');

// ═══════════════════════════════════════════════════════════════════
// JWT Authentication & Route Whitelisting Middleware
// Whitelisted public routes bypass JWT verification
// ═══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'aegisvault-super-secret-jwt-key-2026';

/**
 * List of path prefixes / exact paths that do not require JWT authentication
 */
const PUBLIC_ROUTE_PREFIXES = [
  '/health',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password'
];

/**
 * Checks if the request URL matches any whitelisted public route
 */
const isPublicRoute = (path) => {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
};

/**
 * Express Middleware for JWT Validation
 */
const jwtAuthMiddleware = (req, res, next) => {
  const { originalUrl, method } = req;

  // Allow OPTIONS CORS preflight requests
  if (method === 'OPTIONS') {
    return next();
  }

  // Check if route is whitelisted
  if (isPublicRoute(originalUrl)) {
    return next();
  }

  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    // Basic cookie parsing for accessToken
    const cookies = req.headers.cookie.split(';').map((c) => c.trim());
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
    if (accessCookie) {
      token = accessCookie.split('=')[1];
    }
  }

  if (!token) {
    logger.warn('Authentication failed: Missing JWT access token', {
      path: originalUrl,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer access token.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Inject user identity headers for downstream microservices
    const userId = decoded.sub || decoded.id || decoded.userId || '';
    const userRole = decoded.role || 'CUSTOMER';
    const userEmail = decoded.email || '';

    req.headers['x-user-id'] = String(userId);
    req.headers['x-user-role'] = String(userRole);
    req.headers['x-user-email'] = String(userEmail);

    next();
  } catch (err) {
    logger.warn('Authentication failed: Invalid or expired JWT access token', {
      error: err.message,
      path: originalUrl,
      ip: req.ip
    });

    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      success: false,
      error: isExpired
        ? 'Access token has expired. Please refresh your session.'
        : 'Invalid access token. Authentication denied.',
      code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'
    });
  }
};

module.exports = {
  jwtAuthMiddleware,
  isPublicRoute
};
