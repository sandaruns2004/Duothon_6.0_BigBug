const request = require('supertest');
const app = require('../src/index');

describe('Notification Service Integration Tests', () => {
  let testUserId;

  beforeAll(() => {
    testUserId = 'dummy-user-id';
  });

  it('should successfully hit the GET /api/notifications endpoint', async () => {
    const response = await request(app)
      .get(`/api/notifications`)
      .set('x-user-id', testUserId);
    
    // Should return 200 and an array of notifications (or empty array)
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should successfully hit the GET /api/audit endpoint (Admin only)', async () => {
    const response = await request(app)
      .get(`/api/audit`)
      .set('x-user-id', testUserId)
      .set('x-user-role', 'ADMIN');
    
    // Should return 200 and an array of audit logs
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should block non-admins from hitting the GET /api/audit endpoint', async () => {
    const response = await request(app)
      .get(`/api/audit`)
      .set('x-user-id', testUserId)
      .set('x-user-role', 'CUSTOMER');
    
    expect(response.status).toBe(403);
  });
});
