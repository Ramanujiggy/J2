// Smoke tests for user_tags routes — focused on the Technique Library v1
// surfaces added in migration 027:
//   • Extended PATCH /api/user-tags/:id accepting `affinity` + `resonance_journal`
//   • New POST /api/user-tags/promote-canonical (idempotent canonical → user_tag fork)
// Mocked DB; verifies route wiring, validation, and that the controller calls
// the correct model fns with the right arguments.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  default: { connect: vi.fn() },
}));

vi.mock('../src/models/userTagModel.js', () => ({
  getUserTags: vi.fn(),
  upsertUserTag: vi.fn(),
  updateUserTag: vi.fn(),
  updateUserTagVideo: vi.fn(),
  deleteUserTag: vi.fn(),
  setAffinity: vi.fn(),
  setResonanceJournal: vi.fn(),
  promoteCanonicalToUserTag: vi.fn(),
}));

import app from '../src/app.js';
import * as userTagModel from '../src/models/userTagModel.js';

const TEST_USER_ID = 'user-uuid-1';
const AUTH_TOKEN = jwt.sign({ id: TEST_USER_ID, email: 'test@example.com' }, 'test-secret-for-vitest', { expiresIn: '1h' });
const AUTH_HEADER = `Bearer ${AUTH_TOKEN}`;

const BASE_TAG = {
  id: 'tag-uuid-1',
  user_id: TEST_USER_ID,
  name: 'De La Riva',
  parent_pillar: 'guard',
  aliases: [],
  created_at: '2026-05-05T00:00:00Z',
};

beforeEach(() => { vi.clearAllMocks(); });

// ── PATCH /api/user-tags/:id — affinity + resonance ─────────────────────────

describe('PATCH /api/user-tags/:id (mig 027 affinity + resonance)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/user-tags/tag-uuid-1').send({ affinity: 'go_to' });
    expect(res.status).toBe(401);
  });

  it('updates affinity and calls setAffinity with the right args', async () => {
    vi.mocked(userTagModel.setAffinity).mockResolvedValue({ ...BASE_TAG, affinity: 'go_to' } as never);

    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ affinity: 'go_to' });

    expect(res.status).toBe(200);
    expect(res.body.tag.affinity).toBe('go_to');
    expect(vi.mocked(userTagModel.setAffinity)).toHaveBeenCalledWith(TEST_USER_ID, 'tag-uuid-1', 'go_to');
    // updateUserTag (the name/pillar one) should NOT have been called when only affinity was sent
    expect(vi.mocked(userTagModel.updateUserTag)).not.toHaveBeenCalled();
  });

  it('clears affinity when null is passed', async () => {
    vi.mocked(userTagModel.setAffinity).mockResolvedValue({ ...BASE_TAG, affinity: null } as never);

    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ affinity: null });

    expect(res.status).toBe(200);
    expect(vi.mocked(userTagModel.setAffinity)).toHaveBeenCalledWith(TEST_USER_ID, 'tag-uuid-1', null);
  });

  it('rejects an invalid affinity value', async () => {
    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ affinity: 'love_it' });

    expect(res.status).toBe(400);
    expect(vi.mocked(userTagModel.setAffinity)).not.toHaveBeenCalled();
  });

  it('updates resonance_journal and calls setResonanceJournal', async () => {
    vi.mocked(userTagModel.setResonanceJournal).mockResolvedValue({
      ...BASE_TAG, resonance_journal: 'feels solid now',
    } as never);

    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ resonance_journal: 'feels solid now' });

    expect(res.status).toBe(200);
    expect(res.body.tag.resonance_journal).toBe('feels solid now');
    expect(vi.mocked(userTagModel.setResonanceJournal)).toHaveBeenCalledWith(TEST_USER_ID, 'tag-uuid-1', 'feels solid now');
  });

  it('rejects a resonance_journal over 5000 chars', async () => {
    const longText = 'x'.repeat(5001);
    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ resonance_journal: longText });

    expect(res.status).toBe(400);
    expect(vi.mocked(userTagModel.setResonanceJournal)).not.toHaveBeenCalled();
  });

  it('returns 400 when no updatable fields are provided', async () => {
    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('applies name + affinity in one request, calling both model fns', async () => {
    vi.mocked(userTagModel.updateUserTag).mockResolvedValue({ ...BASE_TAG, name: 'DLR' } as never);
    vi.mocked(userTagModel.setAffinity).mockResolvedValue({ ...BASE_TAG, name: 'DLR', affinity: 'go_to' } as never);

    const res = await request(app)
      .patch('/api/user-tags/tag-uuid-1')
      .set('Authorization', AUTH_HEADER)
      .send({ name: 'DLR', affinity: 'go_to' });

    expect(res.status).toBe(200);
    expect(vi.mocked(userTagModel.updateUserTag)).toHaveBeenCalled();
    expect(vi.mocked(userTagModel.setAffinity)).toHaveBeenCalledWith(TEST_USER_ID, 'tag-uuid-1', 'go_to');
    // The response reflects the latest patch applied (the one that ran last)
    expect(res.body.tag.affinity).toBe('go_to');
  });
});

// ── POST /api/user-tags/promote-canonical (mig 027) ─────────────────────────

describe('POST /api/user-tags/promote-canonical (mig 027)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/user-tags/promote-canonical')
      .send({ canonical_position_id: 'cp-uuid-1' });
    expect(res.status).toBe(401);
  });

  it('returns 201 + created:true on first promote', async () => {
    vi.mocked(userTagModel.promoteCanonicalToUserTag).mockResolvedValue({
      tag: BASE_TAG as never,
      created: true,
    });

    const res = await request(app)
      .post('/api/user-tags/promote-canonical')
      .set('Authorization', AUTH_HEADER)
      .send({ canonical_position_id: 'cp-uuid-1' });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.tag.id).toBe('tag-uuid-1');
    expect(vi.mocked(userTagModel.promoteCanonicalToUserTag)).toHaveBeenCalledWith(TEST_USER_ID, 'cp-uuid-1');
  });

  it('returns 200 + created:false on subsequent calls (idempotent)', async () => {
    vi.mocked(userTagModel.promoteCanonicalToUserTag).mockResolvedValue({
      tag: BASE_TAG as never,
      created: false,
    });

    const res = await request(app)
      .post('/api/user-tags/promote-canonical')
      .set('Authorization', AUTH_HEADER)
      .send({ canonical_position_id: 'cp-uuid-1' });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(false);
    expect(res.body.tag.id).toBe('tag-uuid-1');
  });

  it('returns 404 when the canonical_position_id does not exist', async () => {
    vi.mocked(userTagModel.promoteCanonicalToUserTag).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/user-tags/promote-canonical')
      .set('Authorization', AUTH_HEADER)
      .send({ canonical_position_id: 'cp-uuid-missing' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when canonical_position_id is missing', async () => {
    const res = await request(app)
      .post('/api/user-tags/promote-canonical')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(vi.mocked(userTagModel.promoteCanonicalToUserTag)).not.toHaveBeenCalled();
  });
});
