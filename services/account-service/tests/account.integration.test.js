const request = require('supertest');
const app = require('../src/index'); // Assumes express app is exported

describe('Account Service Integration Tests', () => {
  let testAccountId;
  let testUserId;

  beforeAll(() => {
    // Dummy IDs to test real endpoints without mocking. 
    // We expect valid DB interactions even if it results in empty arrays or 404s.
    testAccountId = 'dummy-account-id';
    testUserId = 'dummy-user-id';
  });

  it('should successfully hit the GET /api/accounts endpoint', async () => {
    const response = await request(app)
      .get(`/api/accounts`)
      .set('x-user-id', testUserId);
    
    // A valid response is either an array of accounts (200) or an empty array (200).
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should successfully hit the GET /api/accounts/:id/balance endpoint', async () => {
    const response = await request(app)
      .get(`/api/accounts/${testAccountId}/balance`)
      .set('x-user-id', testUserId);
    
    // 200 = Success, 404/400 = Account not found in DB
    expect([200, 400, 404]).toContain(response.status);
  });

  it('should block requests without x-user-id header', async () => {
    const response = await request(app)
      .get(`/api/accounts`);
    
    // Depending on the exact implementation, it might throw 401 or 403 or 400
    expect([400, 401, 403]).toContain(response.status);
  });
});
