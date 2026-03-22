import { describe, it, expect } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../src/middleware/authMiddleware.js';

// Minimal Express app that exercises the middleware directly
const app = express();
app.use(express.json());
app.get('/protected', verifyToken, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

const TEST_SECRET = 'test-secret-for-vitest';

// ---- verifyToken middleware --------------------------------------------------

describe('verifyToken middleware', () => {
  it('returns 401 when Authorization header is absent', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  it('returns 401 when header is present but missing Bearer prefix', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'justthetoken');
    expect(res.status).toBe(401);
  });

  it('returns 401 with "Token expired" when the JWT is expired', async () => {
    const expiredToken = jwt.sign(
      { id: 'user-1', email: 'a@b.com' },
      TEST_SECRET,
      { expiresIn: -1 }, // already expired
    );
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/token expired/i);
  });

  it('returns 401 with "Invalid token" when signature is wrong', async () => {
    const badToken = jwt.sign({ id: 'user-1', email: 'a@b.com' }, 'wrong-secret');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  it('calls next() and attaches req.user when token is valid', async () => {
    const token = jwt.sign({ id: 'user-uuid-1', email: 'test@example.com' }, TEST_SECRET, { expiresIn: '1h' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-uuid-1');
    expect(res.body.user.email).toBe('test@example.com');
  });
});
