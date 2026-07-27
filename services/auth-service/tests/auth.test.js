const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

process.env.JWT_SECRET = 'aegisvault-super-secret-jwt-key-2026';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_aegisvault';

// Mock Prisma and Redis before importing the Express app
jest.mock('../src/config/db', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    otpRecord: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback()),
    $on: jest.fn(),
  };

  return { prisma: mockPrisma };
});

jest.mock('../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  },
}));

// Mock axios calls (e.g. to notification service)
jest.mock('axios');
const axios = require('axios');
axios.post.mockResolvedValue({ data: { success: true } });

const { prisma } = require('../src/config/db');
const app = require('../src/index');

describe('🔐 AegisVault Auth Service Unit & Integration Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Health Check Endpoint (/health)', () => {
    it('should return 200 OK and healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('auth-service');
    });
  });

  describe('2. User Registration (POST /api/auth/register)', () => {
    it('should successfully register a new user with valid Sri Lankan NIC', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'usr-new-100',
        email: 'newuser@aegisvault.com',
        phone: '+94770001111',
        nic: '200412345678',
        role: 'CUSTOMER',
        kycStatus: 'PENDING',
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@aegisvault.com',
          phone: '+94770001111',
          nic: '200412345678',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('newuser@aegisvault.com');
    });

    it('should return 409 Conflict if email or NIC already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'usr-existing',
        email: 'test@aegisvault.com',
        nic: '981234567V',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@aegisvault.com',
          phone: '+94771234567',
          nic: '981234567V',
          password: 'SecurePassword123!',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('3. User Authentication & 5-Attempt Lockout (POST /api/auth/login)', () => {
    it('should lock out account after 5 failed login attempts', async () => {
      const lockedUser = {
        id: 'usr-test-locked',
        email: 'locked@aegisvault.com',
        passwordHash: '$2b$12$eXAMPLehAsHeDPaSsWoRDhAsH',
        failedAttempts: 4, // 5th fail will trigger lockout
        isLocked: false,
      };

      prisma.user.findUnique.mockResolvedValue(lockedUser);
      prisma.user.update.mockResolvedValue({
        ...lockedUser,
        failedAttempts: 5,
        isLocked: true,
      });

      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@aegisvault.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('5 consecutive failed login attempts');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-test-locked' },
        data: {
          failedAttempts: 5,
          isLocked: true,
        },
      });
    });

    it('should reject login immediately if account is already locked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-test-locked',
        email: 'locked@aegisvault.com',
        isLocked: true,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'locked@aegisvault.com',
          password: 'SomePassword!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Account is locked');
    });
  });

  describe('4. JWT Generation & MFA Verification (POST /api/auth/verify-otp)', () => {
    it('should issue valid JWT access and refresh tokens upon successful OTP verification', async () => {
      const user = {
        id: 'usr-test-1',
        email: 'test@aegisvault.com',
        role: 'CUSTOMER',
        kycStatus: 'VERIFIED',
      };

      prisma.user.findUnique.mockResolvedValue(user);

      const sha256OtpHash = crypto.createHash('sha256').update('123456').digest('hex');
      prisma.otpRecord.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'usr-test-1',
        otpHash: sha256OtpHash,
        type: 'MFA_LOGIN',
        expiresAt: new Date(Date.now() + 300000),
      });

      const res = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: 'test@aegisvault.com',
          otp: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
      expect(decoded.userId || decoded.sub).toBe('usr-test-1');
      expect(decoded.role).toBe('CUSTOMER');
    });
  });
});
