import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/sessionModel.js', () => ({
  createSession: vi.fn(),
  getSessionsByUser: vi.fn(),
  updateSession: vi.fn(),
  bulkInsertSessions: vi.fn(),
}));

import app from '../src/app.js';
import * as sessionModel from '../src/models/sessionModel.js';

// Valid JWT signed with the vitest test secret
const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_SESSION_BODY = {
  date: '2024-06-15',
  duration: 90,
  gi_nogi: 'gi',
  intensity: 3,
  session_type: 'class',
  notes: 'Good session',
  tags: ['submissions'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Log Session (POST /api/sessions) ---------------------------------------

describe('POST /api/sessions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/sessions').send(VALID_SESSION_BODY);
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ date: '2024-06-15' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid date format', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, date: '15-06-2024' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/date/i);
  });

  it('returns 400 when intensity is out of range', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, intensity: 6 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/intensity/i);
  });

  it('returns 400 for an invalid gi_nogi value', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, gi_nogi: 'barefoot' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/gi_nogi/i);
  });

  it('returns 400 for an invalid session_type', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, session_type: 'sparring' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when no tags are provided', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, tags: [] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tag/i);
  });

  it('returns 400 for an invalid tag value', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, tags: ['not_a_real_tag'] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when duration exceeds 720 minutes', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SESSION_BODY, duration: 721 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/duration/i);
  });

  it('returns 201 with the created session on success', async () => {
    const mockSession = { id: 'session-uuid-1', user_id: TEST_USER_ID, ...VALID_SESSION_BODY };
    vi.mocked(sessionModel.createSession).mockResolvedValue(mockSession as never);
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_SESSION_BODY);
    expect(res.status).toBe(201);
    expect(res.body.session.id).toBe('session-uuid-1');
    expect(vi.mocked(sessionModel.createSession)).toHaveBeenCalledWith(
      TEST_USER_ID, VALID_SESSION_BODY.date, VALID_SESSION_BODY.duration,
      VALID_SESSION_BODY.notes, VALID_SESSION_BODY.gi_nogi, VALID_SESSION_BODY.intensity,
      VALID_SESSION_BODY.session_type, VALID_SESSION_BODY.tags,
      null, null, null, null, null,
    );
  });
});

// ---- Get Sessions (GET /api/sessions) ---------------------------------------

describe('GET /api/sessions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(401);
  });

  it('returns 200 with sessions array on success', async () => {
    vi.mocked(sessionModel.getSessionsByUser).mockResolvedValue([]);
    const res = await request(app).get('/api/sessions').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sessions');
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });
});

// ---- Bulk Import (POST /api/sessions/import) --------------------------------

describe('POST /api/sessions/import', () => {
  const VALID_IMPORT_ROW = {
    date: '2023-01-15',
    duration: 90,
    gi_nogi: 'gi',
    intensity: 3,
    session_type: 'class',
    tags: ['submissions'],
    notes: '',
  };

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/sessions/import').send({ sessions: [VALID_IMPORT_ROW] });
    expect(res.status).toBe(401);
  });

  it('returns 400 when sessions array is empty', async () => {
    const res = await request(app)
      .post('/api/sessions/import')
      .set('Authorization', AUTH_HEADER)
      .send({ sessions: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when sessions array exceeds 500 rows', async () => {
    const rows = Array.from({ length: 501 }, () => ({ ...VALID_IMPORT_ROW }));
    const res = await request(app)
      .post('/api/sessions/import')
      .set('Authorization', AUTH_HEADER)
      .send({ sessions: rows });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/500/);
  });

  it('returns 400 with row label when a row has an invalid date', async () => {
    const res = await request(app)
      .post('/api/sessions/import')
      .set('Authorization', AUTH_HEADER)
      .send({ sessions: [{ ...VALID_IMPORT_ROW, date: 'not-a-date' }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Row 1/);
  });

  it('returns 400 with row label when a row has no tags', async () => {
    const res = await request(app)
      .post('/api/sessions/import')
      .set('Authorization', AUTH_HEADER)
      .send({ sessions: [{ ...VALID_IMPORT_ROW, tags: [] }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Row 1/);
  });

  it('returns 201 with imported count on success', async () => {
    vi.mocked(sessionModel.bulkInsertSessions).mockResolvedValue(2);
    const res = await request(app)
      .post('/api/sessions/import')
      .set('Authorization', AUTH_HEADER)
      .send({ sessions: [VALID_IMPORT_ROW, { ...VALID_IMPORT_ROW, date: '2023-01-16' }] });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
  });
});

// ---- Update Session (PUT /api/sessions/:id) ---------------------------------

describe('PUT /api/sessions/:id', () => {
  const UPDATE_BODY = {
    duration: 60,
    gi_nogi: 'no_gi',
    intensity: 4,
    session_type: 'drilling',
    notes: 'Updated',
    tags: ['guard_passing'],
  };

  it('returns 401 without auth token', async () => {
    const res = await request(app).put('/api/sessions/some-id').send(UPDATE_BODY);
    expect(res.status).toBe(401);
  });

  it('returns 404 when session is not found or not owned by user', async () => {
    vi.mocked(sessionModel.updateSession).mockResolvedValue(null);
    const res = await request(app)
      .put('/api/sessions/nonexistent-id')
      .set('Authorization', AUTH_HEADER)
      .send(UPDATE_BODY);
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated session on success', async () => {
    const mockUpdated = { id: 'session-uuid-1', user_id: TEST_USER_ID, date: '2024-06-15', ...UPDATE_BODY };
    vi.mocked(sessionModel.updateSession).mockResolvedValue(mockUpdated as never);
    const res = await request(app)
      .put('/api/sessions/session-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send(UPDATE_BODY);
    expect(res.status).toBe(200);
    expect(res.body.session.id).toBe('session-uuid-1');
  });
});
