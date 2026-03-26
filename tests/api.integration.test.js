'use strict';

/**
 * tests/api.integration.test.js
 * Smoke-tests the Express application endpoints using supertest.
 * Mocks the Zoho API service so no real HTTP calls are made.
 */

jest.mock('../src/services/zohoApiService');
jest.mock('../src/services/zohoAuthService');
jest.mock('../src/utils/tokenStore');

const request = require('supertest');
const app     = require('../src/server');
const zoho    = require('../src/services/zohoApiService');
const store   = require('../src/utils/tokenStore');

const API_KEY = 'test-api-key';

beforeAll(() => {
  process.env.INTERNAL_API_KEY = API_KEY;
  process.env.NODE_ENV         = 'test';
  store.getAccessToken.mockResolvedValue('mock-token');
  store.cacheGet.mockResolvedValue(null);
  store.cacheSet.mockResolvedValue();
  store.cacheDel.mockResolvedValue();
});

// ── Health ────────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with status field', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────
describe('Auth middleware', () => {
  it('rejects requests without API key', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('accepts requests with valid API key', async () => {
    zoho.getRecords.mockResolvedValue({ data: [], info: {} });
    const res = await request(app)
      .get('/api/leads')
      .set('X-API-Key', API_KEY);
    expect(res.status).toBe(200);
  });
});

// ── Leads ─────────────────────────────────────────────────────────────────────
describe('GET /api/leads', () => {
  it('returns mapped lead list', async () => {
    zoho.getRecords.mockResolvedValue({
      data: [{ First_Name: 'Jane', Last_Name: 'Doe', Email: 'jane@example.com' }],
      info: { page: 1, per_page: 50, count: 1, more_records: false },
    });

    const res = await request(app)
      .get('/api/leads')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toHaveProperty('firstName', 'Jane');
    expect(res.body.data[0]).toHaveProperty('lastName', 'Doe');
  });
});

describe('POST /api/leads', () => {
  it('creates a lead and returns 201', async () => {
    zoho.upsertRecords.mockResolvedValue([{ id: 'abc123', status: 'success' }]);

    const res = await request(app)
      .post('/api/leads')
      .set('X-API-Key', API_KEY)
      .send({ lastName: 'Smith', email: 'smith@example.com', company: 'Widgets Inc' });

    expect(res.status).toBe(201);
    expect(res.body.data[0].id).toBe('abc123');
  });

  it('validates that lastName is required', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('X-API-Key', API_KEY)
      .send({ email: 'noname@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });
});

// ── Sync ──────────────────────────────────────────────────────────────────────
describe('POST /api/sync/push', () => {
  it('pushes records to Zoho', async () => {
    zoho.upsertRecords.mockResolvedValue([{ id: 'x1' }]);

    const res = await request(app)
      .post('/api/sync/push')
      .set('X-API-Key', API_KEY)
      .send({ module: 'Leads', records: [{ lastName: 'Test' }] });

    expect(res.status).toBe(200);
    expect(res.body.pushed).toBe(1);
  });

  it('rejects invalid module names', async () => {
    const res = await request(app)
      .post('/api/sync/push')
      .set('X-API-Key', API_KEY)
      .send({ module: 'Invoices', records: [{}] });

    expect(res.status).toBe(422);
  });
});

// ── Webhooks ─────────────────────────────────────────────────────────────────
describe('POST /webhooks/zoho', () => {
  it('acknowledges a valid webhook (no secret configured)', async () => {
    delete process.env.WEBHOOK_SECRET;
    const res = await request(app)
      .post('/webhooks/zoho')
      .send({ module: 'Leads', operation: 'insert', data: [{ id: '1' }] });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
