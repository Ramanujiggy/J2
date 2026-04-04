// Offline write queue — stores failed write requests in IndexedDB and replays
// them when connectivity returns. Uses the `idb` package for ergonomic access.

import { openDB, type IDBPDatabase } from 'idb';

interface QueuedRequest {
  id: string;
  timestamp: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
}

const DB_NAME = 'journada-offline';
const STORE = 'pending';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Add a write request to the offline queue. */
export async function enqueue(
  method: QueuedRequest['method'],
  path: string,
  body?: unknown,
): Promise<void> {
  const db = await getDb();

  // For PATCH to the same path, replace the existing entry (journal autosave dedup)
  if (method === 'PATCH') {
    const all: QueuedRequest[] = await db.getAll(STORE);
    const existing = all.find(r => r.method === 'PATCH' && r.path === path);
    if (existing) {
      await db.put(STORE, { ...existing, body, timestamp: Date.now() });
      return;
    }
  }

  const entry: QueuedRequest = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    method,
    path,
    body,
  };
  await db.add(STORE, entry);
}

/** Number of pending queued requests. */
export async function count(): Promise<number> {
  const db = await getDb();
  return db.count(STORE);
}

/** Replay all queued requests. Returns counts of synced/failed items. */
export async function flush(): Promise<{ synced: number; failed: number }> {
  const db = await getDb();
  const all: QueuedRequest[] = await db.getAll(STORE);
  // Sort by timestamp so they replay in order
  all.sort((a, b) => a.timestamp - b.timestamp);

  let synced = 0;
  let failed = 0;

  const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
  const token = localStorage.getItem('token');

  for (const req of all) {
    try {
      const res = await fetch(`${BASE_URL}${req.path}`, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: req.body != null ? JSON.stringify(req.body) : undefined,
      });

      if (res.status === 401) {
        // Token expired — keep in queue, user needs to re-login
        failed++;
        continue;
      }

      // Treat any non-5xx as success (including 4xx like 409 duplicate)
      if (res.status < 500) {
        await db.delete(STORE, req.id);
        synced++;
      } else {
        failed++;
      }
    } catch {
      // Still offline or network error — stop trying
      failed += all.length - synced - failed;
      break;
    }
  }

  return { synced, failed };
}
