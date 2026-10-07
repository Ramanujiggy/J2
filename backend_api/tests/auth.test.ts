import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Shared mock client for the transactional reset-password path. The
// controller does `pool.connect()` then `client.query('BEGIN')` etc., so
// individual tests configure `mockClient.query` per scenario.
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

// All vi.mock calls are hoisted — these run before any imports below
vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  default: { connect: vi.fn(() => Promise.resolve(mockClient)) },
}));

vi.mock('../src/models/userModel.js', () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updatePasswordHash: vi.fn(),
}));

vi.mock('../src/models/passwordResetModel.js', () => ({
  createResetToken: vi.fn(),
  findValidToken: vi.fn(),
  markTokenUsed: vi.fn(),
}));

vi.mock('../src/services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashed'),
    compare: vi.fn(),
  },
}));

import app from '../src/app.js';
import * as userModel from '../src/models/userModel.js';
import * as passwordResetModel from '../src/models/passwordResetModel.js';
import bcrypt from 'bcrypt';

const TEST_USER = { id: 'user-uuid-1', email: 'test@example.com', password_hash: '$2b$12$hashed' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Register ---------------------------------------------------------------

describe('POST /auth/register', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/register').send({ password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid email format', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });

  it('returns 409 when email is already registered', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(TEST_USER);
    const res = await request(app).post('/auth/register').send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('returns 201 and user data on success', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(null);
    vi.mocked(userModel.createUser).mockResolvedValue(TEST_USER);
    const res = await request(app).post('/auth/register').send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_USER.email);
    expect(res.body.user).not.toHaveProperty('password_hash');
  });
});

// ---- Login ------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when email is not found', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(null);
    const res = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'pass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('returns 401 when password does not match', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(TEST_USER);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    const res = await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns 200 with a JWT on success', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(TEST_USER);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const res = await request(app).post('/auth/login').send({ email: 'test@example.com', password: 'correctpass' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    // Token should be verifiable with the test secret
    const decoded = jwt.verify(res.body.token, 'test-secret-for-vitest') as { id: string; email: string };
    expect(decoded.id).toBe(TEST_USER.id);
    expect(decoded.email).toBe(TEST_USER.email);
  });
});

// ---- Request Password Reset -------------------------------------------------

describe('POST /auth/request-password-reset', () => {
  it('always returns 200 regardless of whether the email exists (no enumeration)', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(null);
    const res = await request(app).post('/auth/request-password-reset').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if that email exists/i);
  });

  it('returns 200 and sends email when user exists', async () => {
    vi.mocked(userModel.findUserByEmail).mockResolvedValue(TEST_USER);
    vi.mocked(passwordResetModel.createResetToken).mockResolvedValue(undefined);
    const { sendPasswordResetEmail } = await import('../src/services/emailService.js');
    const res = await request(app).post('/auth/request-password-reset').send({ email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(vi.mocked(sendPasswordResetEmail)).toHaveBeenCalledOnce();
  });

  it('returns 200 even with no body (no crash)', async () => {
    const res = await request(app).post('/auth/request-password-reset').send({});
    expect(res.status).toBe(200);
  });
});

// ---- Reset Password ---------------------------------------------------------

describe('POST /auth/reset-password', () => {
  it('returns 400 when token or newPassword is missing', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  it('returns 400 when password is under 8 characters', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'abc', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  it('returns 400 for an invalid or expired token', async () => {
    // The controller opens a transaction and looks the token up through the
    // model with the transaction client — BEGIN/ROLLBACK go through mockClient,
    // the lookup itself is the mocked model returning null.
    mockClient.query.mockReset();
    mockClient.query.mockResolvedValue({ rows: [] });   // BEGIN / ROLLBACK
    vi.mocked(passwordResetModel.findValidToken).mockResolvedValue(null);

    const res = await request(app).post('/auth/reset-password').send({ token: 'badtoken', newPassword: 'newpassword123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or has expired/i);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 200 and marks the token used on success', async () => {
    mockClient.query.mockReset();
    mockClient.query.mockResolvedValue({ rows: [] });   // BEGIN / COMMIT
    vi.mocked(passwordResetModel.findValidToken).mockResolvedValue({
      id: 'token-uuid-1',
      user_id: TEST_USER.id,
      token: 'hashed',
      expires_at: new Date(Date.now() + 3_600_000),
      used: false,
      created_at: new Date(),
    });
    vi.mocked(userModel.updatePasswordHash).mockResolvedValue(undefined);
    vi.mocked(passwordResetModel.markTokenUsed).mockResolvedValue(undefined);

    const res = await request(app).post('/auth/reset-password').send({ token: 'validtoken', newPassword: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated successfully/i);
    expect(vi.mocked(passwordResetModel.markTokenUsed)).toHaveBeenCalledWith('token-uuid-1', mockClient);
    // Verify the raw token is never looked up — only its SHA-256 hash — and that
    // the lookup runs on the transaction client with the row locked.
    const expectedHash = crypto.createHash('sha256').update('validtoken').digest('hex');
    expect(vi.mocked(passwordResetModel.findValidToken)).toHaveBeenCalledWith(expectedHash, mockClient, true);
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
