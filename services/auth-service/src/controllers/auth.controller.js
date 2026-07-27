const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { redisClient } = require('../config/redis');
const { logger } = require('../config/logger');
const {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  sendOtpEmail
} = require('../utils/otp');

// ═══════════════════════════════════════════════════════════════════
// Auth Controller for AegisVault (Register, MFA Login, Verify OTP, Refresh)
// ═══════════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || 'aegisvault-super-secret-jwt-key-2026';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const OTP_TTL_SECONDS = 300; // 5 minutes

/**
 * POST /api/auth/register
 * Register a new user with bcrypt password hashing (cost=12)
 */
const register = async (req, res) => {
  try {
    const { email, phone, nic, password, role } = req.body;

    // Check existing unique identifiers
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { phone },
          { nic }
        ]
      }
    });

    if (existingUser) {
      let conflictField = 'email';
      if (existingUser.phone === phone) conflictField = 'phone number';
      if (existingUser.nic === nic) conflictField = 'NIC';

      return res.status(409).json({
        success: false,
        error: `An account with this ${conflictField} already exists.`
      });
    }

    // Hash password with bcrypt cost factor = 12
    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        phone,
        nic,
        passwordHash,
        role: role || 'CUSTOMER',
        kycStatus: 'PENDING',
        failedAttempts: 0,
        isLocked: false
      },
      select: {
        id: true,
        email: true,
        phone: true,
        nic: true,
        role: true,
        kycStatus: true,
        createdAt: true
      }
    });

    logger.info('👤 New user registered successfully:', { userId: newUser.id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully. Please login to complete MFA verification.',
      user: newUser
    });
  } catch (err) {
    logger.error('Registration error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to complete user registration. Please try again later.'
    });
  }
};

/**
 * POST /api/auth/login
 * Credential check, failed attempt counter, lockout after 5 attempts, and MFA OTP email dispatch
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Check account lockout enforcement
    if (user.isLocked) {
      logger.warn('Login attempt on locked account:', { userId: user.id, email: user.email });
      return res.status(403).json({
        success: false,
        error: 'Account is locked due to multiple failed login attempts. Please contact customer support to unlock your account.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const newFailedCount = user.failedAttempts + 1;
      const shouldLock = newFailedCount >= 5;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedCount,
          isLocked: shouldLock
        }
      });

      if (shouldLock) {
        logger.warn('🚨 Account locked due to 5 consecutive failed login attempts:', { userId: user.id, email: user.email });
        return res.status(403).json({
          success: false,
          error: 'Your account has been locked due to 5 consecutive failed login attempts. Please contact customer support.'
        });
      }

      logger.warn('Invalid password attempt:', { userId: user.id, email: user.email, failedAttempts: newFailedCount });
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        attemptsRemaining: 5 - newFailedCount
      });
    }

    // Reset failed attempts counter on successful password verification
    if (user.failedAttempts > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0 }
      });
    }

    // Generate 6-digit MFA OTP
    const otp = generateNumericOtp(6);
    const otpHash = hashOtp(otp);

    // Store OTP in Redis with 5-min TTL
    const redisKey = `aegis_otp:login:${user.email.toLowerCase()}`;
    try {
      await redisClient.set(redisKey, otpHash, 'EX', OTP_TTL_SECONDS);
    } catch (redisErr) {
      logger.warn('Redis cache set failed during login OTP caching, falling back to DB only', { error: redisErr.message });
    }

    // Also persist OTP record in database for audit/fallback
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
    await prisma.otpRecord.create({
      data: {
        userId: user.id,
        otpHash,
        type: 'MFA_LOGIN',
        expiresAt
      }
    });

    // Send OTP via Notification Service
    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      success: true,
      message: 'MFA verification code sent to your registered email address. This code expires in 5 minutes.',
      userId: user.id,
      email: user.email,
      requireMfa: true,
      expiresInSeconds: OTP_TTL_SECONDS
    });
  } catch (err) {
    logger.error('Login error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'An error occurred during authentication. Please try again later.'
    });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify 6-digit MFA OTP against Redis -> issue access token (15m) & refresh token (7d)
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const cleanEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User account not found for this email address.'
      });
    }

    // Lookup OTP hash from Redis cache first
    const redisKey = `aegis_otp:login:${cleanEmail}`;
    let cachedHash = null;
    try {
      cachedHash = await redisClient.get(redisKey);
    } catch (redisErr) {
      logger.warn('Redis read failed during OTP check, falling back to database query', { error: redisErr.message });
    }

    // Fallback to database query if Redis miss
    if (!cachedHash) {
      const dbOtp = await prisma.otpRecord.findFirst({
        where: {
          userId: user.id,
          type: 'MFA_LOGIN',
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (dbOtp) {
        cachedHash = dbOtp.otpHash;
      }
    }

    if (!cachedHash) {
      return res.status(400).json({
        success: false,
        error: 'Your MFA verification code has expired or is invalid. Please login again to request a new OTP.'
      });
    }

    // Verify OTP hash in constant time
    const isOtpValid = verifyOtpHash(otp, cachedHash);

    if (!isOtpValid) {
      logger.warn('Invalid MFA OTP attempt:', { userId: user.id, email: user.email });
      return res.status(400).json({
        success: false,
        error: 'Invalid MFA verification code. Please check your email and try again.'
      });
    }

    // OTP verified: Clean up OTP from Redis
    try {
      await redisClient.del(redisKey);
    } catch (e) {
      // ignore del error
    }

    // Issue JWT Access Token (15 minutes)
    const accessTokenPayload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus
    };

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });

    // Issue Refresh Token (7 days)
    const refreshTokenPayload = {
      sub: user.id,
      id: user.id,
      type: 'refresh'
    };

    const refreshToken = jwt.sign(refreshTokenPayload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN
    });

    // Hash and persist refresh token in database
    const tokenHash = hashOtp(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: refreshExpiresAt
      }
    });

    logger.info('🔓 MFA OTP verified successfully. Tokens issued:', { userId: user.id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        nic: user.nic,
        role: user.role,
        kycStatus: user.kycStatus
      }
    });
  } catch (err) {
    logger.error('Verify OTP error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify OTP. Please try again later.'
    });
  }
};

/**
 * POST /api/auth/refresh
 * Validate refresh token -> issue new access token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: rToken } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(rToken, JWT_SECRET);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token is invalid or has expired. Please login again.'
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type provided.'
      });
    }

    const tokenHash = hashOtp(rToken);
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!storedToken || !storedToken.user) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token session not found or revoked. Please login again.'
      });
    }

    const user = storedToken.user;

    // Issue new 15m Access Token
    const accessTokenPayload = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus
    };

    const newAccessToken = jwt.sign(accessTokenPayload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      expiresIn: 900
    });
  } catch (err) {
    logger.error('Refresh token error:', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'An error occurred while refreshing your session.'
    });
  }
};

module.exports = {
  register,
  login,
  verifyOtp,
  refreshToken
};
