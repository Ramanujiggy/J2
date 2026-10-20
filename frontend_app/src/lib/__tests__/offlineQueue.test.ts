import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory stand-in for the `idb` wrapper: one object store keyed by `id`.
const store = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock('idb', () => ({
  openDB: async () => ({
    getAll: async () => [...store.values()].map(v => ({ ...v })),
    add: async (_s: string, v: { id: string }) => { store.set(v.id, { ...v }); },
    put: async (_s: string, v: { id: string }) => { store.set(v.id, { ...v }); },
    delete: async (_s: string, id: string) => { store.delete(id); },
    count: async () => store.size,
  }),
}));

import { enqueue, count, flush } from '../offlineQueue.ts';

const fetchMock = vi.fn();
function respond(status: number) {
  return new Response(JSON.stringify({}), { status, headers: { 'content-type': 'application/json' } });
}
const paths = () => [...store.values()].map(r => r.path);

beforeEach(() => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('token', 't0k');
});
afterEach(() => vi.unstubAllGlobals());

describe('enqueue', () => {
  it('stores each write', async () => {
    await enqueue('POST', '/api/sessions', { a: 1 });
    await enqueue('DELETE', '/api/sessions/1');
    expect(await count()).toBe(2);
  });

  it('collapses repeat PATCHes to the same path into the latest body (journal autosave)', async () => {
    await enqueue('PATCH', '/api/sessions/1', { notes: 'first' });
    await enqueue('PATCH', '/api/sessions/1', { notes: 'second' });
    await enqueue('PATCH', '/api/sessions/2', { notes: 'other' });
    expect(await count()).toBe(2);
    const s1 = [...store.values()].find(r => r.path === '/api/sessions/1');
    expect(s1?.body).toEqual({ notes: 'second' });
  });
});

describe('flush', () => {
  it('replays oldest first with the auth token and clears synced writes', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(2000); await enqueue('POST', '/second', { n: 2 });
    now.mockReturnValueOnce(1000); await enqueue('POST', '/first', { n: 1 });
    now.mockRestore();
    fetchMock.mockResolvedValue(respond(201));

    expect(await flush()).toEqual({ synced: 2, failed: 0 });
    expect(fetchMock.mock.calls.map(c => c[0])).toEqual(['/first', '/second']);
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer t0k');
    expect(await count()).toBe(0);
  });

  it('keeps a write when the token has expired (401)', async () => {
    await enqueue('POST', '/api/sessions', {});
    fetchMock.mockResolvedValue(respond(401));
    expect(await flush()).toEqual({ synced: 0, failed: 1 });
    expect(paths()).toEqual(['/api/sessions']);
  });

  it('drops a write the server rejects (4xx) and announces it', async () => {
    const onRejected = vi.fn();
    window.addEventListener('journada:offline-sync-rejected', onRejected);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await enqueue('POST', '/api/sessions', { bad: true });
    fetchMock.mockResolvedValue(respond(422));

    expect(await flush()).toEqual({ synced: 0, failed: 0 });
    expect(await count()).toBe(0);
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect((onRejected.mock.calls[0]![0] as CustomEvent).detail).toEqual({ url: '/api/sessions', status: 422 });
    window.removeEventListener('journada:offline-sync-rejected', onRejected);
  });

  it('keeps a write when the server errors (5xx)', async () => {
    await enqueue('POST', '/api/sessions', {});
    fetchMock.mockResolvedValue(respond(503));
    expect(await flush()).toEqual({ synced: 0, failed: 1 });
    expect(await count()).toBe(1);
  });

  it('stops at the first network failure and keeps everything not yet sent', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValueOnce(1); await enqueue('POST', '/a', {});
    now.mockReturnValueOnce(2); await enqueue('POST', '/b', {});
    now.mockReturnValueOnce(3); await enqueue('POST', '/c', {});
    now.mockRestore();
    fetchMock
      .mockResolvedValueOnce(respond(200))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    expect(await flush()).toEqual({ synced: 1, failed: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(paths().sort()).toEqual(['/b', '/c']);
  });
});
