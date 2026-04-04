// Application-level read cache — stores successful GET responses in IndexedDB
// so they can be served when the user is offline and Workbox has no cache hit.
// Uses the same `idb` package as offlineQueue.ts.

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'journada-cache';
const STORE = 'responses';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

/** Store a GET response in the cache (keyed by full URL path incl. query params). */
export async function setCached(url: string, data: unknown): Promise<void> {
  const db = await getDb();
  await db.put(STORE, { data, timestamp: Date.now() }, url);
}

/** Retrieve a cached GET response. Returns null if not found or expired (>24h). */
export async function getCached<T>(url: string): Promise<T | null> {
  const db = await getDb();
  const entry = await db.get(STORE, url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > MAX_AGE_MS) return null;
  return entry.data as T;
}
