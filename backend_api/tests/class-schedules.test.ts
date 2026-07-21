// Smoke tests for class-schedule CRUD (mig 020). Mocked DB; verifies
// route wiring + the validation contract (day_of_week 0..6, time HH:MM,
// duration_min 15..480, gi_nogi enum).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/classScheduleModel.js', () => ({
  listSchedulesForUser: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  softDeleteSchedule: vi.fn(),
  listAllActiveSchedulesWithTimezone: vi.fn(),
}));

import app from '../src/app.js';
import * as classScheduleModel from '../src/models/classScheduleModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_SCHEDULE = {
  name: 'Tue Night BJJ',
  day_of_week: 2,
  start_time: '19:00',
  duration_min: 90,
  gi_nogi: 'gi',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/class-schedules', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/class-schedules');
    expect(res.status).toBe(401);
  });

  it('returns the user\'s schedules', async () => {
    vi.mocked(classScheduleModel.listSchedulesForUser).mockResolvedValue([
      { id: 'sch-1', user_id: TEST_USER_ID, ...VALID_SCHEDULE, start_time: '19:00:00', is_active: true, created_at: '...' } as never,
    ]);
    const res = await request(app).get('/api/class-schedules').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(200);
    expect(res.body.schedules).toHaveLength(1);
  });
});

describe('POST /api/class-schedules', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/class-schedules').send(VALID_SCHEDULE);
    expect(res.status).toBe(401);
  });

  it('creates a schedule with a valid payload', async () => {
    vi.mocked(classScheduleModel.createSchedule).mockResolvedValue({
      id: 'sch-1', user_id: TEST_USER_ID, ...VALID_SCHEDULE,
      start_time: '19:00:00', is_active: true, created_at: '...',
    } as never);

    const res = await request(app).post('/api/class-schedules')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_SCHEDULE);

    expect(res.status).toBe(201);
    expect(res.body.schedule.name).toBe('Tue Night BJJ');
  });

  it('rejects an invalid day_of_week', async () => {
    const res = await request(app).post('/api/class-schedules')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SCHEDULE, day_of_week: 7 });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed start_time', async () => {
    const res = await request(app).post('/api/class-schedules')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SCHEDULE, start_time: '19:00 PM' });
    expect(res.status).toBe(400);
  });

  it('rejects duration_min outside 15..480', async () => {
    const res = await request(app).post('/api/class-schedules')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SCHEDULE, duration_min: 600 });
    expect(res.status).toBe(400);
  });

  it('accepts gi_nogi: "both" (mig 025)', async () => {
    vi.mocked(classScheduleModel.createSchedule).mockResolvedValue({
      id: 'sch-1', user_id: TEST_USER_ID, ...VALID_SCHEDULE, gi_nogi: 'both',
      start_time: '19:00:00', is_active: true, created_at: '...',
    } as never);

    const res = await request(app).post('/api/class-schedules')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SCHEDULE, gi_nogi: 'both' });

    expect(res.status).toBe(201);
  });
});

describe('DELETE /api/class-schedules/:id', () => {
  it('returns 204 on successful soft-delete', async () => {
    vi.mocked(classScheduleModel.softDeleteSchedule).mockResolvedValue(true);
    const res = await request(app).delete('/api/class-schedules/sch-1').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(204);
  });

  it('returns 404 when the schedule does not exist or is already inactive', async () => {
    vi.mocked(classScheduleModel.softDeleteSchedule).mockResolvedValue(false);
    const res = await request(app).delete('/api/class-schedules/sch-missing').set('Authorization', AUTH_HEADER);
    expect(res.status).toBe(404);
  });
});
