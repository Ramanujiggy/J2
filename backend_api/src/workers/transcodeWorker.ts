// transcodeWorker — in-process polling worker that turns raw uploads into
// universally-playable H.264/AAC MP4s.
//
// Pipeline per job:
//   1. Claim the next pending row via FOR UPDATE SKIP LOCKED + 15-min stale
//      guard (so a worker that died mid-encode doesn't strand the job).
//   2. Download raw object from R2 → temp file.
//   3. ffmpeg → second temp file (encoded MP4).
//   4. Upload encoded → R2.
//   5. UPDATE row: status='ready', storage_key set, raw key cleared.
//   6. Delete raw object from R2.
//   7. Cleanup temp files.
//
// Errors at any step → mark status='failed' with the error message; leave
// the raw object in R2 so the user's "Retry" button can re-encode without
// re-uploading.
//
// Single-process assumption: Railway's free tier runs one replica. If we
// scale horizontally later, FOR UPDATE SKIP LOCKED already guarantees
// safety — multiple workers will compete for the same job pool, claim
// disjoint jobs, and continue.

import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';

import * as userTagModel from '../models/userTagModel.js';
import * as sessionVideoModel from '../models/sessionVideoModel.js';
import * as r2 from '../lib/r2Client.js';
import { transcodeToH264Mp4, probeFfmpeg } from '../lib/transcode.js';

// Tunables —
const POLL_INTERVAL_MS = 5_000;     // claim cadence when the queue is empty
const ACTIVE_INTERVAL_MS = 100;     // chain quickly when we just finished a job
const ERROR_BACKOFF_MS = 30_000;    // back off 30s after a tick error (give the DB pool room to recover before retrying)

let running = false;
let stopped = false;
let activeTimer: NodeJS.Timeout | null = null;

/**
 * Boot the worker. Idempotent — calling twice is a no-op. Logs the ffmpeg
 * version to make a missing-binary failure obvious in production logs.
 *
 * Returns a stop fn for graceful shutdown (used in tests).
 */
export async function startTranscodeWorker(): Promise<() => Promise<void>> {
    if (running) return async () => {};
    running = true;
    stopped = false;

    const ffmpegVersion = await probeFfmpeg();
    if (ffmpegVersion) {
        console.log(`✅ Transcode worker booting; ${ffmpegVersion}`);
    } else {
        console.error(
            '⚠️  Transcode worker booting BUT ffmpeg is not available on PATH. ' +
            'Encodes will fail. Confirm nixpacks.toml installed ffmpeg, or install locally.',
        );
    }

    // Kick off the first tick immediately, then schedule subsequent ticks
    // dynamically based on whether the last tick claimed a job.
    void scheduleNextTick(0);

    return async () => {
        stopped = true;
        if (activeTimer) clearTimeout(activeTimer);
        running = false;
    };
}

function scheduleNextTick(delayMs: number): void {
    if (stopped) return;
    // Defensive: clear any pending timer before scheduling a new one. Without
    // this, an early-return path that schedules + then a finally that also
    // schedules (or any other dual-schedule pattern) leaks timers — they
    // compound silently because the `activeTimer` variable only tracks the
    // most recent reference, and previous setTimeout handles stay live.
    if (activeTimer) {
        clearTimeout(activeTimer);
        activeTimer = null;
    }
    activeTimer = setTimeout(() => { void tickOnce(); }, delayMs);
}

/**
 * One iteration: try to claim a job, run the encode, schedule the next tick.
 *
 * Cadence:
 *   • Claimed + processed a job → 100ms (chain quickly to drain the queue)
 *   • No job available           → 5s   (idle poll)
 *   • Error caught at this layer → 30s  (back off so transient DB-pool
 *                                        problems don't escalate into a
 *                                        sustained tick storm)
 *
 * IMPORTANT: schedule exactly once per tick. Earlier versions had the
 * "no job" path schedule + a finally clause also schedule, causing
 * duplicate timers to compound and hammer the DB. Single source of truth
 * (`nextDelayMs`) avoids that.
 */
async function tickOnce(): Promise<void> {
    if (stopped) return;
    let claimedId: string | null = null;
    let claimedKind: 'tag' | 'session_video' | null = null;
    let nextDelayMs = POLL_INTERVAL_MS;

    try {
        // Check both queues; technique-library tags take priority (they're
        // typically short clips and have been waiting since before session
        // videos were added).
        const tagJob = await userTagModel.claimNextTranscodeJob();
        if (tagJob) {
            claimedId = tagJob.id;
            claimedKind = 'tag';
            nextDelayMs = ACTIVE_INTERVAL_MS;
            await processTagJob(tagJob);
        } else {
            const svJob = await sessionVideoModel.claimNextTranscodeJob();
            if (svJob) {
                claimedId = svJob.id;
                claimedKind = 'session_video';
                nextDelayMs = ACTIVE_INTERVAL_MS;
                await processSessionVideoJob(svJob);
            }
            // else: both queues empty — idle cadence is the default.
        }
    } catch (err) {
        console.error(`❌ Transcode worker tick error${claimedId ? ` (${claimedKind} ${claimedId})` : ''}:`, err);
        nextDelayMs = ERROR_BACKOFF_MS;
        if (claimedId) {
            try {
                if (claimedKind === 'tag') {
                    await userTagModel.markTranscodeFailed(claimedId, err instanceof Error ? err.message : String(err));
                } else if (claimedKind === 'session_video') {
                    await sessionVideoModel.markTranscodeFailed(claimedId, err instanceof Error ? err.message : String(err));
                }
            } catch {
                // best-effort
            }
        }
    } finally {
        scheduleNextTick(nextDelayMs);
    }
}

async function processTagJob(job: { id: string; user_id: string; video_raw_storage_key?: string | null }): Promise<void> {
    const rawKey = job.video_raw_storage_key;
    if (!rawKey) {
        await userTagModel.markTranscodeFailed(job.id, 'Internal error: claimed job has no raw_storage_key.');
        return;
    }
    await runTranscode({
        id: job.id,
        userId: job.user_id,
        rawKey,
        encodedKey: r2.encodedStorageKey(job.user_id, job.id),
        onReady: (encodedKey, size) => userTagModel.markTranscodeReady(job.id, encodedKey, size),
        onFailed: (msg) => userTagModel.markTranscodeFailed(job.id, msg),
        label: `tag ${job.id}`,
    });
}

async function processSessionVideoJob(job: { id: string; user_id: string; video_raw_storage_key?: string | null }): Promise<void> {
    const rawKey = job.video_raw_storage_key;
    if (!rawKey) {
        await sessionVideoModel.markTranscodeFailed(job.id, 'Internal error: claimed job has no raw_storage_key.');
        return;
    }
    await runTranscode({
        id: job.id,
        userId: job.user_id,
        rawKey,
        encodedKey: r2.encodedSessionVideoKey(job.user_id, job.id),
        onReady: (encodedKey, size) => sessionVideoModel.markTranscodeReady(job.id, encodedKey, size),
        onFailed: (msg) => sessionVideoModel.markTranscodeFailed(job.id, msg),
        label: `session video ${job.id}`,
    });
}

async function runTranscode(opts: {
    id: string;
    userId: string;
    rawKey: string;
    encodedKey: string;
    onReady: (encodedKey: string, size: number) => Promise<unknown>;
    onFailed: (msg: string) => Promise<unknown>;
    label: string;
}): Promise<void> {
    const tag = `${opts.id}-${randomUUID().slice(0, 8)}`;
    const rawTempPath = path.join(tmpdir(), `j2-raw-${tag}`);
    const encodedTempPath = path.join(tmpdir(), `j2-enc-${tag}.mp4`);

    try {
        const stream = await r2.getObjectStream(opts.rawKey);
        await pipeline(stream, createWriteStream(rawTempPath));

        await transcodeToH264Mp4({ inputPath: rawTempPath, outputPath: encodedTempPath });

        const encodedStat = await fs.stat(encodedTempPath);
        const encodedBytes = await fs.readFile(encodedTempPath);

        await r2.putObject(opts.encodedKey, encodedBytes, 'video/mp4');
        await opts.onReady(opts.encodedKey, encodedStat.size);

        try {
            await r2.deleteObject(opts.rawKey);
        } catch (err) {
            console.error(`⚠️  Failed to delete raw object ${opts.rawKey} after successful encode:`, err);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Transcode failed for ${opts.label}:`, message);
        await opts.onFailed(message);
    } finally {
        await fs.rm(rawTempPath,     { force: true }).catch(() => {});
        await fs.rm(encodedTempPath, { force: true }).catch(() => {});
    }
}
