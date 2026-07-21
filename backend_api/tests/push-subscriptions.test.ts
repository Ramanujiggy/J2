// Smoke tests for Web Push subscription routes (mig 021). Mocked DB +
// mocked webPushClient (we don't actually verify VAPID config here; the
// public key endpoint just reads an env var).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/pushSubscriptionModel.js', () => ({
  upsertSubscription: vi.fn(),
  listSubscriptionsForUser: vi.fn(),
  listSubscriptionsForUserByKind: vi.fn(),
  deleteSubscriptionByEndpoint: vi.fn(),
  updateCategoryFlagsForUser: vi.fn(),
}));

vi.mock('../src/lib/webPushClient.js', () => ({
  configureWebPush: vi.fn().mockReturnValue(true),
  getVapidPublicKey: vi.fn().mockReturnValue('BTestPublicKey123'),
  sendPush: vi.fn(),
}));

import app from '../src/app.js';
import * as pushModel from '../src/models/pushSubscriptionModel.js';
import * as webPush from '../src/lib/webPushClient.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const VALID_SUBSCRIPTION = {
  endpoint: 'https://push.apple.com/3aB-fake-endpoint',
  keys: {
    p256dh: 'BPx_fake_p256dh_key_value_here_padded_for_length',
    auth:   'fake_auth_secret_16',
  },
  user_agent: 'iPhone 15 / iOS 17.4 PWA',
};

beforeEach(() => { vi.clearAllMocks(); });

describe('GET /api/push-subscriptions/vapid-public-key', () => {
  it('returns the VAPID public key (no auth required — public endpoint)', async () => {
    const res = await request(app).get('/api/push-subscriptions/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.vapidPublicKey).toBe('BTestPublicKey123');
  });

  it('returns 503 when push is not configured', async () => {
    vi.mocked(webPush.getVapidPublicKey).mockReturnValueOnce(null);
    const res = await request(app).get('/api/push-subscriptions/vapid-public-key');
    expect(res.status).toBe(503);
  });
});

describe('POST /api/push-subscriptions', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/push-subscriptions').send(VALID_SUBSCRIPTION);
    expect(res.status).toBe(401);
  });

  it('upserts a subscription with valid keys', async () => {
    vi.mocked(pushModel.upsertSubscription).mockResolvedValue({
      id: 'sub-1', user_id: TEST_USER_ID,
      endpoint: VALID_SUBSCRIPTION.endpoint,
      p256dh: VALID_SUBSCRIPTION.keys.p256dh,
      auth: VALID_SUBSCRIPTION.keys.auth,
      user_agent: VALID_SUBSCRIPTION.user_agent,
      pre_class: true, intention_check: true, drive_home_log: true,
      last_seen: '...', created_at: '...',
    } as never);

    const res = await request(app)
      .post('/api/push-subscriptions')
      .set('Authorization', AUTH_HEADER)
      .send(VALID_SUBSCRIPTION);

    expect(res.status).toBe(201);
    expect(res.body.subscription.id).toBe('sub-1');
    expect(res.body.subscription.pre_class).toBe(true);
  });

  it('rejects a non-https endpoint', async () => {
    const res = await request(app)
      .post('/api/push-subscriptions')
      .set('Authorization', AUTH_HEADER)
      .send({ ...VALID_SUBSCRIPTION, endpoint: 'http://evil.example.com' });

    expect(res.status).toBe(400);
  });

  it('rejects missing keys', async () => {
    const res = await request(app)
      .post('/api/push-subscriptions')
      .set('Authorization', AUTH_HEADER)
      .send({ endpoint: VALID_SUBSCRIPTION.endpoint });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/push-subscriptions/categories', () => {
  it('updates category flags', async () => {
    vi.mocked(pushModel.updateCategoryFlagsForUser).mockResolvedValue(undefined);
    vi.mocked(pushModel.listSubscriptionsForUser).mockResolvedValue([{
      id: 'sub-1', user_id: TEST_USER_ID, endpoint: 'x', p256dh: 'y', auth: 'z',
      user_agent: null,
      pre_class: false, intention_check: true, drive_home_log: true,
      last_seen: '...', created_at: '...',
    }] as never);

    const res = await request(app)
      .patch('/api/push-subscriptions/categories')
      .set('Authorization', AUTH_HEADER)
      .send({ pre_class: false });

    expect(res.status).toBe(200);
    expect(res.body.categories.pre_class).toBe(false);
  });
});

describe('DELETE /api/push-subscriptions', () => {
  it('removes a subscription by endpoint', async () => {
    vi.mocked(pushModel.deleteSubscriptionByEndpoint).mockResolvedValue(true);
    const res = await request(app)
      .delete('/api/push-subscriptions')
      .set('Authorization', AUTH_HEADER)
      .send({ endpoint: VALID_SUBSCRIPTION.endpoint });

    expect(res.status).toBe(204);
  });
});
