// Smoke tests for class-attendance endpoints (mig 029). Mocked DB; verifies
// route wiring, auth requirement, validation contract, and the model-level
// shape of the GET / PUT / POST-import handlers.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/classAttendanceModel.js', () => ({
  listAttendanceInWindow: vi.fn(),
  upsertAttendanceFlag: vi.fn(),
  batchImportAttendance: vi.fn(),
}));

import app from '../src/app.js';
import * as classAttendanceModel from '../src/models/classAttendanceModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign(
  { id: TEST_USER_ID, email: 'test@example.com' },
  'test-secret-for-vitest',
  { expiresIn: '1h' },
);
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const SCHEDULE_ID = '11111111-1111-1111-1111-111111111111';
const DATE_STR = '2026-05-09';

beforeEach(() => { vi.clearAllMocks(); });

// ── GET ────────────────────────────────────────────────────────────────────

describe('GET /api/class-attendance', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/class-attendance');
    expect(res.status).toBe(401);
  });

  it('returns the user\'s attendance rows', async () => {
    vi.mocked(classAttendanceModel.listAttendanceInWindow).mockResolvedValue([
      {
        id: 'att-1', user_id: TEST_USER_ID, schedule_id: SCHEDULE_ID,
        date: DATE_STR, planning: 'yes', attended: null, updated_at: '...',
      },
    ]);
    const res = await request(app)
      .get('/api/class-attendance')
      .set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.attendance).toHaveLength(1);
    expect(res.body.attendance[0].planning).toBe('yes');
  });

  it('honors from + to query params when valid', async () => {
    vi.mocked(classAttendanceModel.listAttendanceInWindow).mockResolvedValue([]);
    const res = await request(app)
      .get('/api/class-attendance?from=2026-05-01&to=2026-05-31')
      .set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(classAttendanceModel.listAttendanceInWindow).toHaveBeenCalledWith(
      TEST_USER_ID, '2026-05-01', '2026-05-31',
    );
  });

  it('rejects an inverted from > to range', async () => {
    const res = await request(app)
      .get('/api/class-attendance?from=2026-05-31&to=2026-05-01')
      .set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(400);
  });
});

// ── PUT ────────────────────────────────────────────────────────────────────

describe('PUT /api/class-attendance', () => {
  const VALID = { schedule_id: SCHEDULE_ID, date: DATE_STR, flag: 'planning', value: 'yes' };

  it('returns 401 without auth', async () => {
    const res = await request(app).put('/api/class-attendance').send(VALID);
    expect(res.status).toBe(401);
  });

  it('upserts a single flag with a valid payload', async () => {
    vi.mocked(classAttendanceModel.upsertAttendanceFlag).mockResolvedValue({
      id: 'att-1', user_id: TEST_USER_ID, schedule_id: SCHEDULE_ID,
      date: DATE_STR, planning: 'yes', attended: null, updated_at: '...',
    });
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send(VALID);
    expect(res.status).toBe(200);
    expect(classAttendanceModel.upsertAttendanceFlag).toHaveBeenCalledWith(
      TEST_USER_ID, SCHEDULE_ID, DATE_STR, 'planning', 'yes',
    );
    expect(res.body.attendance.planning).toBe('yes');
  });

  it('accepts value: null to clear a flag', async () => {
    vi.mocked(classAttendanceModel.upsertAttendanceFlag).mockResolvedValue({
      id: 'att-1', user_id: TEST_USER_ID, schedule_id: SCHEDULE_ID,
      date: DATE_STR, planning: null, attended: null, updated_at: '...',
    });
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID, value: null });
    expect(res.status).toBe(200);
    expect(classAttendanceModel.upsertAttendanceFlag).toHaveBeenCalledWith(
      TEST_USER_ID, SCHEDULE_ID, DATE_STR, 'planning', null,
    );
  });

  it('rejects an unknown flag', async () => {
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID, flag: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown value', async () => {
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID, value: 'kind-of' });
    expect(res.status).toBe(400);
  });

  it('rejects a non-UUID schedule_id', async () => {
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID, schedule_id: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date', async () => {
    const res = await request(app)
      .put('/api/class-attendance')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID, date: '2026/05/09' });
    expect(res.status).toBe(400);
  });
});

// ── POST /import ───────────────────────────────────────────────────────────

describe('POST /api/class-attendance/import', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/class-attendance/import')
      .send({ entries: [] });
    expect(res.status).toBe(401);
  });

  it('imports a batch of valid entries', async () => {
    vi.mocked(classAttendanceModel.batchImportAttendance).mockResolvedValue(2);
    const res = await request(app)
      .post('/api/class-attendance/import')
      .set('Authorization', AUTH_HEADER)
      .send({
        entries: [
          { schedule_id: SCHEDULE_ID, date: DATE_STR, planning: 'yes' },
          { schedule_id: SCHEDULE_ID, date: '2026-05-10', attended: 'no' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(classAttendanceModel.batchImportAttendance).toHaveBeenCalledWith(
      TEST_USER_ID,
      [
        { schedule_id: SCHEDULE_ID, date: DATE_STR, planning: 'yes' },
        { schedule_id: SCHEDULE_ID, date: '2026-05-10', attended: 'no' },
      ],
    );
  });

  it('accepts an empty entries array', async () => {
    vi.mocked(classAttendanceModel.batchImportAttendance).mockResolvedValue(0);
    const res = await request(app)
      .post('/api/class-attendance/import')
      .set('Authorization', AUTH_HEADER)
      .send({ entries: [] });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(0);
  });

  it('rejects a non-array entries field', async () => {
    const res = await request(app)
      .post('/api/class-attendance/import')
      .set('Authorization', AUTH_HEADER)
      .send({ entries: { foo: 'bar' } });
    expect(res.status).toBe(400);
  });

  it('rejects an entry with a malformed schedule_id', async () => {
    const res = await request(app)
      .post('/api/class-attendance/import')
      .set('Authorization', AUTH_HEADER)
      .send({ entries: [{ schedule_id: 'nope', date: DATE_STR, planning: 'yes' }] });
    expect(res.status).toBe(400);
  });

  it('rejects an entry with an invalid flag value', async () => {
    const res = await request(app)
      .post('/api/class-attendance/import')
      .set('Authorization', AUTH_HEADER)
      .send({ entries: [{ schedule_id: SCHEDULE_ID, date: DATE_STR, planning: 'maybe' }] });
    expect(res.status).toBe(400);
  });
});
