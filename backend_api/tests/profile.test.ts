// Smoke tests for the profile + onboarding endpoints. Mocked DB; verifies
// route wiring, auth, and validation on the surfaces added in Sprint 10/11
// + the mig 026 onboarding-step funnel.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/profileModel.js', () => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../src/models/userModel.js', () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updatePasswordHash: vi.fn(),
  updateUserTimezone: vi.fn(),
  markOnboardingComplete: vi.fn(),
  setOnboardingStep: vi.fn(),
}));

import app from '../src/app.js';
import * as profileModel from '../src/models/profileModel.js';
import * as userModel from '../src/models/userModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

beforeEach(() => { vi.clearAllMocks(); });

// ── PUT /api/profile ─────────────────────────────────────────────────────────

describe('PUT /api/profile', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).put('/api/profile').send({ name: 'Robert' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and saves a valid payload', async () => {
    vi.mocked(profileModel.getProfile).mockResolvedValue({
      name: null, belt_rank: null, stripes: 0,
      home_gym_name: null, home_gym_address: null, home_gym_place_id: null,
      intentions_enabled: true,
    } as never);
    vi.mocked(profileModel.updateProfile).mockResolvedValue({
      name: 'Robert', belt_rank: 'blue', stripes: 2,
      home_gym_name: null, home_gym_address: null, home_gym_place_id: null,
      intentions_enabled: true,
    } as never);

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'Robert', belt_rank: 'blue', stripes: 2 });

    expect(res.status).toBe(200);
    expect(res.body.profile.name).toBe('Robert');
    expect(res.body.profile.belt_rank).toBe('blue');
  });

  it('returns 400 for an invalid belt_rank', async () => {
    vi.mocked(profileModel.getProfile).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', AUTH_HEADER)
      .send({ belt_rank: 'gold' });

    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/profile/timezone (mig 019) ───────────────────────────────────

describe('PATCH /api/profile/timezone', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/profile/timezone').send({ timezone: 'America/Los_Angeles' });
    expect(res.status).toBe(401);
  });

  it('accepts a valid IANA timezone', async () => {
    vi.mocked(userModel.updateUserTimezone).mockResolvedValue(undefined);
    const res = await request(app)
      .patch('/api/profile/timezone')
      .set('Authorization', AUTH_HEADER)
      .send({ timezone: 'America/Los_Angeles' });

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('America/Los_Angeles');
    expect(vi.mocked(userModel.updateUserTimezone)).toHaveBeenCalledWith(TEST_USER_ID, 'America/Los_Angeles');
  });

  it('rejects a malformed timezone string', async () => {
    const res = await request(app)
      .patch('/api/profile/timezone')
      .set('Authorization', AUTH_HEADER)
      .send({ timezone: 'Not/A/Real_Zone' });

    expect(res.status).toBe(400);
  });
});

// ── POST /api/profile/onboarding-complete (mig 022) ─────────────────────────

describe('POST /api/profile/onboarding-complete', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/profile/onboarding-complete').send({});
    expect(res.status).toBe(401);
  });

  it('marks onboarding complete and returns the updated profile', async () => {
    vi.mocked(userModel.markOnboardingComplete).mockResolvedValue(undefined);
    vi.mocked(profileModel.getProfile).mockResolvedValue({
      name: 'Robert', belt_rank: 'blue', stripes: 0,
      home_gym_name: null, home_gym_address: null, home_gym_place_id: null,
      intentions_enabled: true,
    } as never);

    const res = await request(app)
      .post('/api/profile/onboarding-complete')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(vi.mocked(userModel.markOnboardingComplete)).toHaveBeenCalledWith(TEST_USER_ID);
    expect(res.body.profile.name).toBe('Robert');
  });
});

// ── PATCH /api/profile/onboarding-step (mig 026 — funnel telemetry) ─────────

describe('PATCH /api/profile/onboarding-step', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/profile/onboarding-step').send({ step: 2 });
    expect(res.status).toBe(401);
  });

  it('records a valid step and returns ok', async () => {
    vi.mocked(userModel.setOnboardingStep).mockResolvedValue(undefined);
    const res = await request(app)
      .patch('/api/profile/onboarding-step')
      .set('Authorization', AUTH_HEADER)
      .send({ step: 3 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(vi.mocked(userModel.setOnboardingStep)).toHaveBeenCalledWith(TEST_USER_ID, 3);
  });

  it('rejects a step outside 0..5', async () => {
    const res = await request(app)
      .patch('/api/profile/onboarding-step')
      .set('Authorization', AUTH_HEADER)
      .send({ step: 99 });

    expect(res.status).toBe(400);
  });

  it('rejects a non-integer step', async () => {
    const res = await request(app)
      .patch('/api/profile/onboarding-step')
      .set('Authorization', AUTH_HEADER)
      .send({ step: 1.5 });

    expect(res.status).toBe(400);
  });
});
