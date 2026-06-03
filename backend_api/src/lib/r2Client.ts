// r2Client — Cloudflare R2 access layer for the Move Library v2 (mig 028).
//
// R2 is S3-compatible, so we use the AWS SDK v3 directly with a custom
// endpoint. The bucket (`user-videos-journada` in prod) holds two prefixes:
//
//   raw/{user_id}/{tag_id}-{timestamp}.{ext}   ← the original upload
//   encoded/{user_id}/{tag_id}.mp4             ← the H.264/AAC transcode
//
// Backend never touches the bytes — it only signs URLs. The actual upload
// is a direct PUT from the browser (signed URL), and playback is a direct
// GET from the browser (signed URL). Egress is free on R2, which is why we
// can afford to stream every replay without proxying.
//
// Required environment variables (all five must be set, validated at boot):
//   R2_ACCOUNT_ID         — Cloudflare account id (32-char hex)
//   R2_ACCESS_KEY_ID      — R2 API token, public half
//   R2_SECRET_ACCESS_KEY  — R2 API token, secret half
//   R2_BUCKET_NAME        — e.g. "user-videos-journada"
//   R2_ENDPOINT           — e.g. "https://{account_id}.r2.cloudflarestorage.com"
//
// If any are missing, this module throws at first import (before any
// request can hit it). Failing at boot is the right tradeoff vs. a silent
// 500 on the first upload attempt.

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v || v.length === 0) {
        throw new Error(
            `Missing required environment variable: ${name}. ` +
            `R2 video storage cannot start without all five R2_* vars set ` +
            `(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT).`
        );
    }
    return v;
}

const R2_ACCOUNT_ID        = requireEnv('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID     = requireEnv('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY');
export const R2_BUCKET_NAME = requireEnv('R2_BUCKET_NAME');
const R2_ENDPOINT          = requireEnv('R2_ENDPOINT');

void R2_ACCOUNT_ID; // referenced only to surface the env-var requirement; SDK reads creds directly

// R2 sits behind a single global region but the AWS SDK insists on one being
// set. "auto" is Cloudflare's documented value for region-agnostic R2 buckets.
const r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

/**
 * Mint a short-lived signed PUT URL for a client to upload directly to R2.
 * Default TTL is 5 minutes — enough for a 50MB upload over slow cellular,
 * short enough to keep the attack window small if the URL leaks.
 *
 * Returns { uploadUrl, expiresAt } — the caller is responsible for surfacing
 * `expiresAt` so the client knows when to abort + re-mint.
 */
export async function mintPutUrl(
    storageKey: string,
    contentType: string,
    ttlSeconds: number = 300,
): Promise<{ uploadUrl: string; expiresAt: string }> {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { uploadUrl, expiresAt };
}

/**
 * Mint a short-lived signed GET URL so a client can play the encoded video
 * directly from R2. 5 minutes covers a typical viewing session; the client
 * caches the URL for ~4 minutes before re-minting (less than the TTL so a
 * cached URL is never stale at play time).
 */
export async function mintGetUrl(
    storageKey: string,
    ttlSeconds: number = 300,
): Promise<{ url: string; expiresAt: string }> {
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
    });
    const url = await getSignedUrl(r2Client, command, { expiresIn: ttlSeconds });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    return { url, expiresAt };
}

/**
 * Server-side download of an R2 object — used by the transcoding worker to
 * pull the raw upload before invoking ffmpeg. Returns a Node Readable so the
 * caller can pipe it straight to a temp file without buffering the entire
 * blob in memory.
 *
 * Throws when the object is missing, which the worker treats as a permanent
 * failure (the row was probably deleted while queued).
 */
export async function getObjectStream(storageKey: string): Promise<Readable> {
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
    });
    const result = await r2Client.send(command);
    if (!result.Body) {
        throw new Error(`R2 object missing or empty: ${storageKey}`);
    }
    // result.Body is a stream Readable on Node, a ReadableStream on browsers.
    // We're server-side, so the cast is safe.
    return result.Body as Readable;
}

/**
 * Server-side upload — used by the transcoding worker to push the encoded
 * MP4 back to R2 after ffmpeg completes. Accepts a Buffer so the worker can
 * stat the file then read it once.
 */
export async function putObject(
    storageKey: string,
    body: Buffer,
    contentType: string,
): Promise<void> {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
    });
    await r2Client.send(command);
}

/**
 * Delete an object. Used by the worker to clean up `raw/` keys after a
 * successful encode, and by the controller when a user removes a video from
 * a tag entirely. Idempotent — calling on a missing key is a no-op (R2
 * returns 204 either way).
 */
export async function deleteObject(storageKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
    });
    await r2Client.send(command);
}

/**
 * List every object in the bucket. Paginates internally — handles buckets
 * with >1000 keys. Returns key + byte size for each object. Used by the
 * admin orphan-cleanup task to walk the bucket and compare against the
 * keys claimed by user_tags rows.
 */
export async function listAllObjects(): Promise<Array<{ key: string; sizeBytes: number }>> {
    const all: Array<{ key: string; sizeBytes: number }> = [];
    let continuationToken: string | undefined = undefined;
    while (true) {
        const result: ListObjectsV2CommandOutput = await r2Client.send(
            new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                ContinuationToken: continuationToken,
            }),
        );
        for (const obj of result.Contents ?? []) {
            if (obj.Key) all.push({ key: obj.Key, sizeBytes: obj.Size ?? 0 });
        }
        if (!result.NextContinuationToken) break;
        continuationToken = result.NextContinuationToken;
    }
    return all;
}

// ── Key generators — keep storage layout in one place ──────────────────────

/**
 * Where a freshly-recorded clip lands when the client uploads it. Suffixed
 * with a timestamp so a retry of the same tag doesn't collide with the
 * previous attempt's raw key.
 */
export function rawStorageKey(userId: string, tagId: string, ext: string): string {
    const cleanExt = ext.replace(/^\./, '').toLowerCase().slice(0, 8) || 'bin';
    const ts = Date.now();
    return `raw/${userId}/${tagId}-${ts}.${cleanExt}`;
}

/**
 * Where the transcoded variant lives. Stable per-tag — a re-upload overwrites
 * the previous encoded variant in place.
 */
export function encodedStorageKey(userId: string, tagId: string): string {
    return `encoded/${userId}/${tagId}.mp4`;
}

/**
 * Defensive ownership check on a storage key supplied by the client.
 * The signed-URL flow already constrains uploads to a key the server
 * generated, but the upload-complete handler should re-verify the key
 * begins with `raw/{user_id}/` so a malicious client can't claim a row
 * by passing someone else's storage key.
 */
export function verifyKeyOwnedBy(storageKey: string, userId: string): boolean {
    return storageKey.startsWith(`raw/${userId}/`)
        || storageKey.startsWith(`encoded/${userId}/`);
}
