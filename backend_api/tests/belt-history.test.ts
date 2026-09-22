// Belt history as journal entries (mig 039): the promotion's own words via
// PATCH, and logging a session adopts that day's unlinked promotions.
// Mocked DB; verifies route wiring, auth, validation and the link call.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/beltHistoryModel.js', () => ({
  getHistory: vi.fn(),
  addEntry: vi.fn(),
  deleteEntry: vi.fn(),
  updateNotes: vi.fn(),
  linkSessionToPromotions: vi.fn(),
}));

vi.mock('../src/models/sessionModel.js', () => ({
  createSession: vi.fn(),
  getSessionsByUser: vi.fn(),
  updateSession: vi.fn(),
  bulkInsertSessions: vi.fn(),
}));

import app from '../src/app.js';
import * as beltHistoryModel from '../src/models/beltHistoryModel.js';
import * as sessionModel from '../src/models/sessionModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const ENTRY = {
  id: 'bh-1', user_id: TEST_USER_ID, belt_rank: 'black', stripes: 0,
  promoted_at: '2026-09-18', notes: 'Marco tied it on.', session_id: null,
  created_at: '2026-09-18T20:00:00Z',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('PATCH /api/belt-history/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/belt-history/bh-1').send({ notes: 'x' });
    expect(res.status).toBe(401);
  });

  it('saves the words and returns the entry', async () => {
    vi.mocked(beltHistoryModel.updateNotes).mockResolvedValue(ENTRY);
    const res = await request(app)
      .patch('/api/belt-history/bh-1')
      .set('Authorization', AUTH_HEADER)
      .send({ notes: 'Marco tied it on.' });
    expect(res.status).toBe(200);
    expect(res.body.entry.notes).toBe('Marco tied it on.');
    expect(beltHistoryModel.updateNotes).toHaveBeenCalledWith(TEST_USER_ID, 'bh-1', 'Marco tied it on.');
  });

  it('stores an empty string as null', async () => {
    vi.mocked(beltHistoryModel.updateNotes).mockResolvedValue({ ...ENTRY, notes: null });
    await request(app).patch('/api/belt-history/bh-1').set('Authorization', AUTH_HEADER).send({ notes: '' });
    expect(beltHistoryModel.updateNotes).toHaveBeenCalledWith(TEST_USER_ID, 'bh-1', null);
  });

  it('returns 404 when the entry is not the user’s', async () => {
    vi.mocked(beltHistoryModel.updateNotes).mockResolvedValue(null);
    const res = await request(app).patch('/api/belt-history/nope').set('Authorization', AUTH_HEADER).send({ notes: 'x' });
    expect(res.status).toBe(404);
  });

  it('rejects notes over 2000 characters', async () => {
    const res = await request(app)
      .patch('/api/belt-history/bh-1')
      .set('Authorization', AUTH_HEADER)
      .send({ notes: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(beltHistoryModel.updateNotes).not.toHaveBeenCalled();
  });
});

describe('POST /api/sessions links that day’s promotions', () => {
  const BODY = { date: '2026-09-18', duration: 60, gi_nogi: 'gi', intensity: 3, session_type: 'class', notes: '', tags: [] };

  it('calls linkSessionToPromotions with the new session and its date', async () => {
    vi.mocked(sessionModel.createSession).mockResolvedValue({ id: 'sess-9', user_id: TEST_USER_ID, session_count: 1 } as never);
    const res = await request(app).post('/api/sessions').set('Authorization', AUTH_HEADER).send(BODY);
    expect(res.status).toBe(201);
    expect(beltHistoryModel.linkSessionToPromotions).toHaveBeenCalledWith(TEST_USER_ID, 'sess-9', '2026-09-18');
  });

  it('still returns 201 when the link fails', async () => {
    vi.mocked(sessionModel.createSession).mockResolvedValue({ id: 'sess-9', user_id: TEST_USER_ID, session_count: 1 } as never);
    vi.mocked(beltHistoryModel.linkSessionToPromotions).mockRejectedValue(new Error('db down'));
    const res = await request(app).post('/api/sessions').set('Authorization', AUTH_HEADER).send(BODY);
    expect(res.status).toBe(201);
  });
});
