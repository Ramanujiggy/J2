// Smoke tests for user_tags routes — covers:
//   • Mig 027 surfaces: extended PATCH (affinity + resonance), promote-canonical
//   • Mig 028 surfaces: video upload-url / upload-complete / playback url /
//     retry / remove (cloud video storage)
//
// Mocked DB + mocked r2Client; verifies route wiring, validation, and that
// the controller calls the correct model fns with the right arguments. We
// never hit R2 in tests — the mocked r2Client returns canned signed URLs.

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
  // Mig 028 model fns
  findUserTagById: vi.fn(),
  recordRawUpload: vi.fn(),
  requeueFailedTranscode: vi.fn(),
  clearVideo: vi.fn(),
}));

// Mock r2Client so the test process doesn't need real R2 credentials. We
// stub the helpers the controller calls; the SDK itself never runs.
vi.mock('../src/lib/r2Client.js', () => ({
  rawStorageKey: (userId: string, tagId: string, ext: string) =>
    `raw/${userId}/${tagId}-stub.${ext}`,
  encodedStorageKey: (userId: string, tagId: string) =>
    `encoded/${userId}/${tagId}.mp4`,
  verifyKeyOwnedBy: (key: string, userId: string) =>
    key.startsWith(`raw/${userId}/`) || key.startsWith(`encoded/${userId}/`),
  mintPutUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://r2.example/signed-put',
    expiresAt: '2099-01-01T00:00:00Z',
  }),
  mintGetUrl: vi.fn().mockResolvedValue({
    url: 'https://r2.example/signed-get',
    expiresAt: '2099-01-01T00:00:00Z',
  }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
  R2_BUCKET_NAME: 'test-bucket',
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

// ── Move Library v2: cloud video endpoints (mig 028) ────────────────────────

describe('POST /api/user-tags/:id/video/upload-url (mig 028)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-url')
      .send({ content_type: 'video/mp4', ext: 'mp4' });
    expect(res.status).toBe(401);
  });

  it('mints a signed upload URL for a valid request', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue(BASE_TAG as never);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-url')
      .set('Authorization', AUTH_HEADER)
      .send({ content_type: 'video/quicktime', ext: 'mov' });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBe('https://r2.example/signed-put');
    expect(res.body.storageKey).toBe('raw/user-uuid-1/tag-uuid-1-stub.mov');
    expect(res.body.expiresAt).toBeTruthy();
  });

  it('returns 404 when the tag does not exist or is not owned', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-missing/video/upload-url')
      .set('Authorization', AUTH_HEADER)
      .send({ content_type: 'video/mp4', ext: 'mp4' });

    expect(res.status).toBe(404);
  });

  it('rejects a non-video content_type', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue(BASE_TAG as never);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-url')
      .set('Authorization', AUTH_HEADER)
      .send({ content_type: 'image/png', ext: 'png' });

    expect(res.status).toBe(400);
  });

  it('rejects a missing ext', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue(BASE_TAG as never);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-url')
      .set('Authorization', AUTH_HEADER)
      .send({ content_type: 'video/mp4' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/user-tags/:id/video/upload-complete (mig 028)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-complete')
      .send({ raw_storage_key: 'x', byte_size: 1 });
    expect(res.status).toBe(401);
  });

  it('records upload + flips status to processing on a valid request', async () => {
    vi.mocked(userTagModel.recordRawUpload).mockResolvedValue({
      ...BASE_TAG, has_video: true, video_status: 'processing',
      video_raw_storage_key: 'raw/user-uuid-1/tag-uuid-1-stub.mov', video_byte_size: 1234567,
    } as never);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-complete')
      .set('Authorization', AUTH_HEADER)
      .send({
        raw_storage_key: 'raw/user-uuid-1/tag-uuid-1-stub.mov',
        byte_size: 1234567,
        video_thumbnail: 'data:image/jpeg;base64,abc',
        video_duration_seconds: 12,
      });

    expect(res.status).toBe(200);
    expect(res.body.tag.video_status).toBe('processing');
    expect(vi.mocked(userTagModel.recordRawUpload)).toHaveBeenCalledWith(
      TEST_USER_ID,
      'tag-uuid-1',
      expect.objectContaining({
        raw_storage_key: 'raw/user-uuid-1/tag-uuid-1-stub.mov',
        byte_size: 1234567,
      }),
    );
  });

  it('rejects a raw_storage_key that does not match the user prefix', async () => {
    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-complete')
      .set('Authorization', AUTH_HEADER)
      .send({
        raw_storage_key: 'raw/someone-else/tag-uuid-1.mov',
        byte_size: 100,
        video_thumbnail: null,
        video_duration_seconds: null,
      });

    expect(res.status).toBe(400);
    expect(vi.mocked(userTagModel.recordRawUpload)).not.toHaveBeenCalled();
  });

  it('rejects a byte_size over the 50MB cap', async () => {
    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/upload-complete')
      .set('Authorization', AUTH_HEADER)
      .send({
        raw_storage_key: 'raw/user-uuid-1/tag-uuid-1.mov',
        byte_size: 51 * 1024 * 1024,
        video_thumbnail: null,
        video_duration_seconds: null,
      });

    expect(res.status).toBe(413);
  });
});

describe('GET /api/user-tags/:id/video/url (mig 028)', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/user-tags/tag-uuid-1/video/url');
    expect(res.status).toBe(401);
  });

  it('returns null status when the tag has no video', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue({
      ...BASE_TAG, has_video: false, video_status: null,
    } as never);

    const res = await request(app)
      .get('/api/user-tags/tag-uuid-1/video/url')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBeNull();
    expect(res.body.url).toBeUndefined();
  });

  it("returns processing without a URL while the worker is encoding", async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue({
      ...BASE_TAG, has_video: true, video_status: 'processing',
    } as never);

    const res = await request(app)
      .get('/api/user-tags/tag-uuid-1/video/url')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
    expect(res.body.url).toBeUndefined();
  });

  it('returns failed + message when the encode failed', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue({
      ...BASE_TAG, has_video: true, video_status: 'failed',
      video_status_message: 'ffmpeg exited with code 1',
    } as never);

    const res = await request(app)
      .get('/api/user-tags/tag-uuid-1/video/url')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
    expect(res.body.message).toBe('ffmpeg exited with code 1');
  });

  it('returns ready + signed URL when the encode is done', async () => {
    vi.mocked(userTagModel.findUserTagById).mockResolvedValue({
      ...BASE_TAG, has_video: true, video_status: 'ready',
      video_storage_key: 'encoded/user-uuid-1/tag-uuid-1.mp4',
    } as never);

    const res = await request(app)
      .get('/api/user-tags/tag-uuid-1/video/url')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.url).toBe('https://r2.example/signed-get');
  });
});

describe('POST /api/user-tags/:id/video/retry (mig 028)', () => {
  it('returns 200 + the requeued tag when a failed transcode is retryable', async () => {
    vi.mocked(userTagModel.requeueFailedTranscode).mockResolvedValue({
      ...BASE_TAG, has_video: true, video_status: 'processing',
    } as never);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/retry')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.tag.video_status).toBe('processing');
  });

  it('returns 409 when the tag is not in a failed state', async () => {
    vi.mocked(userTagModel.requeueFailedTranscode).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/user-tags/tag-uuid-1/video/retry')
      .set('Authorization', AUTH_HEADER)
      .send({});

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/user-tags/:id/video (mig 028)', () => {
  it('returns 200 + the cleared tag and best-effort deletes R2 objects', async () => {
    vi.mocked(userTagModel.clearVideo).mockResolvedValue({
      tag: { ...BASE_TAG, has_video: false, video_status: null } as never,
      rawKey: 'raw/user-uuid-1/old.mov',
      encodedKey: 'encoded/user-uuid-1/tag-uuid-1.mp4',
    });

    const res = await request(app)
      .delete('/api/user-tags/tag-uuid-1/video')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.tag.has_video).toBe(false);
    expect(res.body.tag.video_status).toBeNull();
  });

  it('returns 404 when the tag does not exist', async () => {
    vi.mocked(userTagModel.clearVideo).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/user-tags/tag-uuid-missing/video')
      .set('Authorization', AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});
