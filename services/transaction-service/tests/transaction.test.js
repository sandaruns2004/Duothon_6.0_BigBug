const request = require('supertest');

// Mock Prisma before importing the Express app
jest.mock('../src/config/db', () => {
  const mockPrisma = {
    transaction: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      count: jest.fn(),
    },
    fraudAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback()),
    $on: jest.fn(),
  };

  return { prisma: mockPrisma };
});

// Mock axios calls (e.g. to account service and notification service)
jest.mock('axios');
const axios = require('axios');

// Mock RabbitMQ publisher
jest.mock('../src/utils/rabbitmq', () => ({
  publishCommand: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
}));

const { prisma } = require('../src/config/db');
const app = require('../src/index');

describe('💸 AegisVault Transaction Service Unit & Integration Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { success: true } });
  });

  describe('1. Health Check Endpoint (/health)', () => {
    it('should return 200 OK and healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.service).toBe('transaction-service');
    });
  });

  describe('2. ACID Atomic Transfer Execution (POST /api/transactions/transfer)', () => {
    it('should successfully execute atomic interbank transfer and log receipt', async () => {
      // Mock sender balance check from account-service
      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          balance: 500000.00,
          account: {
            accountNumber: '810023459812',
            balance: 500000.00,
            status: 'ACTIVE',
          },
        },
      });

      // Mock account-service atomic execution
      axios.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'ACID transfer executed successfully',
        },
      });

      // Mock transaction DB create
      prisma.transaction.create.mockResolvedValue({
        id: 'txn-test-001',
        fromAccountId: '810023459812',
        toAccountId: '810087654321',
        amount: 25000.00,
        currency: 'LKR',
        type: 'TRANSFER',
        status: 'SUCCESS',
        referenceNumber: 'TXN-2026-TEST1',
        fraudFlag: false,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/transactions/transfer')
        .send({
          fromAccountId: '810023459812',
          toAccountId: '810087654321',
          amount: 25000.00,
          currency: 'LKR',
          description: 'Unit test atomic transfer',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.status).toBe('SUCCESS');
      expect(res.body.transaction.fraudFlag).toBe(false);
    });

    it('should abort transfer and rollback if sender has insufficient funds', async () => {
      // Mock sender balance check returning low balance
      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          balance: 1500.00,
          account: {
            accountNumber: '810023459812',
            balance: 1500.00,
            status: 'ACTIVE',
          },
        },
      });

      const res = await request(app)
        .post('/api/transactions/transfer')
        .send({
          fromAccountId: '810023459812',
          toAccountId: '810087654321',
          amount: 50000.00,
          currency: 'LKR',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Insufficient funds');
    });
  });

  describe('3. Rule-Based Fraud Detection Engine', () => {
    it('should flag transaction (fraudFlag = true) when amount exceeds high-value threshold (Rule 1)', async () => {
      // Mock sender balance check with large balance
      axios.get.mockResolvedValueOnce({
        data: {
          success: true,
          balance: 2000000.00,
          account: {
            accountNumber: '810023459812',
            balance: 2000000.00,
            status: 'ACTIVE',
          },
        },
      });

      axios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      prisma.transaction.create.mockResolvedValue({
        id: 'txn-test-fraud-1',
        fromAccountId: '810023459812',
        toAccountId: '990011223344',
        amount: 650000.00, // > 500,000 threshold
        currency: 'LKR',
        type: 'TRANSFER',
        status: 'SUCCESS',
        referenceNumber: 'TXN-2026-FRAUD1',
        fraudFlag: true,
        createdAt: new Date(),
      });

      prisma.fraudAlert.create.mockResolvedValue({
        id: 'alert-001',
        transactionId: 'txn-test-fraud-1',
        ruleTriggered: 'HIGH_AMOUNT_THRESHOLD',
        riskScore: 85,
        status: 'FLAGGED',
      });

      const res = await request(app)
        .post('/api/transactions/transfer')
        .send({
          fromAccountId: '810023459812',
          toAccountId: '990011223344',
          amount: 650000.00, // > 500k triggers Rule 1
          currency: 'LKR',
          description: 'High value wire test',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.transaction.fraudFlag).toBe(true);
      expect(res.body.fraudAlerts).toBeDefined();
    });
  });
});
