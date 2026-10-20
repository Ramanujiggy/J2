import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const enqueue = vi.hoisted(() => vi.fn(async () => {}));
const getCached = vi.hoisted(() => vi.fn(async () => null as unknown));
const setCached = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../offlineQueue.ts', () => ({ enqueue }));
vi.mock('../apiCache.ts', () => ({ getCached, setCached }));

import { api, ApiError } from '../api.ts';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset(); enqueue.mockClear(); getCached.mockReset(); setCached.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 't0k');
});
afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('sends the bearer token and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: 1 }));
    expect(await api.get('/api/x')).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer t0k');
  });

  it('caches successful reads for offline use', async () => {
    fetchMock.mockResolvedValue(json(200, { sessions: [] }));
    await api.get('/api/sessions');
    await vi.waitFor(() => expect(setCached).toHaveBeenCalledWith('/api/sessions', { sessions: [] }));
  });

  it('queues a write when the network is down and reports it as offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await api.patch<{ _offline?: boolean }>('/api/sessions/1', { notes: 'kept' });
    expect(res._offline).toBe(true);
    expect(enqueue).toHaveBeenCalledWith('PATCH', '/api/sessions/1', { notes: 'kept' });
  });

  it('falls back to the cache for a read when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    getCached.mockResolvedValue({ sessions: ['cached'] });
    expect(await api.get('/api/sessions')).toEqual({ sessions: ['cached'] });
  });

  it('throws a readable error for an uncached read while offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/api/sessions')).rejects.toMatchObject({ status: 0 });
  });

  it('surfaces the server message and fires the auth handler on 401', async () => {
    const onAuth = vi.fn();
    api.setAuthErrorHandler(onAuth);
    fetchMock.mockResolvedValue(json(401, { message: 'Token expired' }));
    const err = await api.get('/api/x').catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Token expired');
    expect(onAuth).toHaveBeenCalled();
  });

  it('explains a non-JSON response instead of failing to parse it', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    await expect(api.get('/api/x')).rejects.toThrow(/Cannot reach the server/);
  });
});
