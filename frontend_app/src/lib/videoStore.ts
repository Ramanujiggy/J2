// videoStore — local persistent storage for Move Library video clips.
//
// Strategy: OPFS (Origin Private File System) first, IndexedDB fallback.
//
// OPFS pros: better performance for large blobs, larger quota in practice,
//   files stream-readable, no double-buffering. iOS Safari 15.2+, Chrome 86+,
//   Firefox 111+.
// IndexedDB pros: universal support. Stores Blob directly. Counts against the
//   same quota bucket on most browsers.
//
// Files keyed by user_tag id. The actual file format is whatever the device
// captured (typically MP4/H.264 on iOS, WebM/VP8 on desktop Chrome).
//
// Quota awareness: hasQuotaFor() and getStorageEstimate() let UI show usage
// before recording — surface "you're near the limit" warnings instead of
// failing silently mid-save.

const DB_NAME = 'journada-videos';
const DB_VERSION = 1;
const STORE = 'clips';
const OPFS_DIR = 'video-clips';

// ─────────────────────────────────────────────────────────────────────────────
// Capability detection
// ─────────────────────────────────────────────────────────────────────────────

let opfsSupported: boolean | null = null;

async function hasOPFS(): Promise<boolean> {
  if (opfsSupported !== null) return opfsSupported;
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      opfsSupported = false;
      return false;
    }
    // Probe — getDirectory throws on some older browsers
    await navigator.storage.getDirectory();
    opfsSupported = true;
    return true;
  } catch {
    opfsSupported = false;
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB layer (fallback)
// ─────────────────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbHas(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getKey(id);
    req.onsuccess = () => { db.close(); resolve(req.result !== undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbListIds(): Promise<string[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => { db.close(); resolve((req.result ?? []) as string[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OPFS layer (preferred)
// ─────────────────────────────────────────────────────────────────────────────

async function opfsDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

async function opfsPut(id: string, blob: Blob): Promise<void> {
  const dir = await opfsDir();
  const file = await dir.getFileHandle(id, { create: true });
  // FileSystemWritableFileStream is async-iterable & truncates on .close()
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function opfsGet(id: string): Promise<Blob | null> {
  try {
    const dir = await opfsDir();
    const file = await dir.getFileHandle(id, { create: false });
    return await file.getFile();
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return null;
    throw err;
  }
}

async function opfsDelete(id: string): Promise<void> {
  try {
    const dir = await opfsDir();
    await dir.removeEntry(id);
  } catch (err) {
    if ((err as DOMException)?.name === 'NotFoundError') return;
    throw err;
  }
}

async function opfsHas(id: string): Promise<boolean> {
  try {
    const dir = await opfsDir();
    await dir.getFileHandle(id, { create: false });
    return true;
  } catch {
    return false;
  }
}

async function opfsListIds(): Promise<string[]> {
  const dir = await opfsDir();
  const ids: string[] = [];
  // FileSystemDirectoryHandle is async-iterable in spec; types may lag
  const iter = (dir as unknown as { entries: () => AsyncIterableIterator<[string, FileSystemHandle]> }).entries();
  for await (const [name] of iter) ids.push(name);
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — auto-routes to OPFS or IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

export async function saveVideo(id: string, blob: Blob): Promise<void> {
  if (await hasOPFS()) return opfsPut(id, blob);
  return idbPut(id, blob);
}

export async function loadVideo(id: string): Promise<Blob | null> {
  if (await hasOPFS()) return opfsGet(id);
  return idbGet(id);
}

export async function deleteVideo(id: string): Promise<void> {
  if (await hasOPFS()) return opfsDelete(id);
  return idbDelete(id);
}

export async function hasVideo(id: string): Promise<boolean> {
  if (await hasOPFS()) return opfsHas(id);
  return idbHas(id);
}

export async function listVideoIds(): Promise<string[]> {
  if (await hasOPFS()) return opfsListIds();
  return idbListIds();
}

/**
 * Delete every cache entry associated with a tag — both the legacy
 * unversioned key (`tagId`) and the post-2026-06 composite keys
 * (`tagId@<size>`). Used by the playback path to sweep stale entries when
 * a new version is fetched from the cloud, and by detachVideo to fully
 * clear the cache for a removed video.
 */
export async function deleteVideosForTag(tagId: string): Promise<void> {
  const all = await listVideoIds();
  const matches = all.filter(k => k === tagId || k.startsWith(`${tagId}@`));
  await Promise.all(matches.map(k => deleteVideo(k)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Quota helpers — surface to UI
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  usagePercent: number; // 0–100
  /** `true` when the browser supports navigator.storage.estimate() */
  supported: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimate> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usageBytes: 0, quotaBytes: 0, usagePercent: 0, supported: false };
  }
  const est = await navigator.storage.estimate();
  const usage = est.usage ?? 0;
  const quota = est.quota ?? 0;
  return {
    usageBytes: usage,
    quotaBytes: quota,
    usagePercent: quota > 0 ? Math.round((usage / quota) * 100) : 0,
    supported: true,
  };
}

/** Returns true if there's headroom for the requested bytes (with a 10% safety margin). */
export async function hasQuotaFor(bytes: number): Promise<boolean> {
  const est = await getStorageEstimate();
  if (!est.supported || est.quotaBytes === 0) return true; // unknown — let it try
  return est.usageBytes + bytes < est.quotaBytes * 0.9;
}
