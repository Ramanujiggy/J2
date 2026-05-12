// Smoke tests for the intentions API. Mocked DB; covers create (which is
// transactional via pool.connect), list, current, patch, journal-patch.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Shared mock client for the transactional create-intention path.
const mockClient = { query: vi.fn(), release: vi.fn() };

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn(() => Promise.resolve(mockClient)) },
}));

vi.mock('../src/models/intentionModel.js', () => ({
  createIntention: vi.fn(),
  shortenIntention: vi.fn(),
  getActiveIntention: vi.fn(),
  getAllIntentions: vi.fn(),
  getIntentionByWeek: vi.fn(),
  updateJournalEntry: vi.fn(),
  updateIntention: vi.fn(),
  deleteIntention: vi.fn(),
}));

import app from '../src/app.js';
import * as intentionModel from '../src/models/intentionModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_INTENTION_BODY = {
  intent_label: 'DLR retention',
  heading: 'guard',
  intent_category: 'positional',
  duration_days: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockClient.query.mockReset();
  mockClient.release.mockReset();
});

describe('POST /api/intentions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/intentions').send(VALID_INTENTION_BODY);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid heading', async () => {
    const res = await request(app)
      .post('/api/intentions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_INTENTION_BODY, heading: 'breakdance' });
    expect(res.status).toBe(400);
  });

  it('rejects intent_label > 20 chars', async () => {
    const res = await request(app)
      .post('/api/intentions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_INTENTION_BODY, intent_label: 'x'.repeat(25) });
    expect(res.status).toBe(400);
  });

  it('rejects duration_days outside 1..30', async () => {
    const res = await request(app)
      .post('/api/intentions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_INTENTION_BODY, duration_days: 60 });
    expect(res.status).toBe(400);
  });

  it('creates a new intention on success', async () => {
    mockClient.query.mockResolvedValue({ rows: [] });
    vi.mocked(intentionModel.getActiveIntention).mockResolvedValue(null);
    vi.mocked(intentionModel.createIntention).mockResolvedValue({
      id: 'int-1', user_id: TEST_USER_ID, week_start: '2026-05-04',
      intent_label: 'DLR retention', intent_category: 'positional', heading: 'guard',
      duration_days: 7, journal_entry: null, created_at: new Date(),
    } as never);

    const res = await request(app)
      .post('/api/intentions')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_INTENTION_BODY);

    expect(res.status).toBe(201);
    expect(res.body.intention.intent_label).toBe('DLR retention');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('GET /api/intentions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/intentions');
    expect(res.status).toBe(401);
  });

  it('returns the user\'s intentions', async () => {
    vi.mocked(intentionModel.getAllIntentions).mockResolvedValue([
      { id: 'int-1', user_id: TEST_USER_ID, week_start: '2026-05-04',
        intent_label: 'guard', intent_category: 'positional', heading: 'guard',
        duration_days: 7, journal_entry: null, created_at: new Date() },
    ] as never);

    const res = await request(app).get('/api/intentions').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.intentions).toHaveLength(1);
  });
});

describe('GET /api/intentions/current', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/intentions/current');
    expect(res.status).toBe(401);
  });

  it('returns 200 when no active intention exists', async () => {
    vi.mocked(intentionModel.getActiveIntention).mockResolvedValue(null);
    vi.mocked(intentionModel.getIntentionByWeek).mockResolvedValue(null);
    const res = await request(app).get('/api/intentions/current').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    // Controller returns { intention: undefined } which JSON-serializes as {}
    // (undefined drops). Either body.intention === null or absent is correct.
    expect(res.body.intention ?? null).toBeNull();
  });
});

describe('DELETE /api/intentions/:id', () => {
  it('returns 200 on successful delete', async () => {
    vi.mocked(intentionModel.deleteIntention).mockResolvedValue(true);
    const res = await request(app).delete('/api/intentions/int-1').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('returns 404 when not found / not owned', async () => {
    vi.mocked(intentionModel.deleteIntention).mockResolvedValue(false);
    const res = await request(app).delete('/api/intentions/int-missing').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(404);
  });
});
