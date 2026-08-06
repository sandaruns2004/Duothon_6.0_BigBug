const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');

describe('Admin Service - Loans Integration Tests', () => {
  let testLoanId;

  beforeAll(() => {
    // If running tests locally outside of Docker, default to localhost instead of docker hostname
    if (!process.env.ACCOUNT_SERVICE_URL) {
      process.env.ACCOUNT_SERVICE_URL = 'http://localhost:3002';
    }

    // We use a dummy ID. Since we are doing a real integration test against a running Account Service,
    // if the Account Service is running but the loan doesn't exist, it should return 404 or 400.
    // If it returns 500 or hangs, the integration is broken.
    testLoanId = 'dummy-loan-id-for-integration';
  });

  it('should successfully hit the PUT /api/admin/loans/:id/reject endpoint and proxy to Account Service', async () => {
    const response = await request(app)
      .put(`/api/admin/loans/${testLoanId}/reject`)
      .set('x-user-role', 'ADMIN')
      .send({ reason: 'Integration Test Rejection' });
    
    // 200 = Success, 404/400 = Loan not found in account service (but proxy worked)
    expect([200, 400, 404]).toContain(response.status);
  });

  it('should successfully hit the PUT /api/admin/loans/:id/approve endpoint and proxy to Account Service', async () => {
    const response = await request(app)
      .put(`/api/admin/loans/${testLoanId}/approve`)
      .set('x-user-role', 'ADMIN');
    
    expect([200, 400, 404]).toContain(response.status);
  });

  it('should reject requests without ADMIN or OFFICER role (403 Forbidden)', async () => {
    const response = await request(app)
      .put(`/api/admin/loans/${testLoanId}/approve`)
      .set('x-user-role', 'CUSTOMER');
    
    expect(response.status).toBe(403);
  });
});
