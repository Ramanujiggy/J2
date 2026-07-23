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
    let claimedTagId: string | null = null;
    let nextDelayMs = POLL_INTERVAL_MS;

    try {
        const job = await userTagModel.claimNextTranscodeJob();
        if (!job) {
            // Queue empty — nothing changes; idle cadence is the default.
            return;
        }
        claimedTagId = job.id;
        nextDelayMs = ACTIVE_INTERVAL_MS;  // we processed work; chain quickly
        await processJob(job);
    } catch (err) {
        // Any error inside processJob is already converted to a 'failed'
        // status update inside that function. An error THIS layer catches
        // is something unexpected (typically a DB connection issue from
        // claimNextTranscodeJob itself) — log, back off, keep the worker alive.
        console.error(`❌ Transcode worker tick error${claimedTagId ? ` (tag ${claimedTagId})` : ''}:`, err);
        nextDelayMs = ERROR_BACKOFF_MS;

        // Defensive: if claim succeeded but processJob threw without going
        // through its own failure path, mark the job failed so it doesn't
        // sit in 'processing' forever. The 15-min stale guard would
        // eventually rescue it, but explicit is better.
        if (claimedTagId) {
            try {
                await userTagModel.markTranscodeFailed(
                    claimedTagId,
                    err instanceof Error ? err.message : String(err),
                );
            } catch {
                // best-effort — DB might still be down
            }
        }
    } finally {
        scheduleNextTick(nextDelayMs);
    }
}

/**
 * Run one job to completion. Either flips the row to 'ready' (on success)
 * or 'failed' (on any error). Cleans up temp files in both paths.
 */
async function processJob(job: { id: string; user_id: string; video_raw_storage_key?: string | null }): Promise<void> {
    const rawKey = job.video_raw_storage_key;
    if (!rawKey) {
        // Defensive: claim returned a row without a raw key. Shouldn't
        // happen given the WHERE clause, but mark failed so we don't loop.
        await userTagModel.markTranscodeFailed(job.id, 'Internal error: claimed job has no raw_storage_key.');
        return;
    }

    // Generate temp paths. Random suffix avoids collisions across overlapping
    // jobs (single-process today, but cheap insurance for future parallelism).
    const tag = `${job.id}-${randomUUID().slice(0, 8)}`;
    const rawTempPath = path.join(tmpdir(), `j2-raw-${tag}`);
    const encodedTempPath = path.join(tmpdir(), `j2-enc-${tag}.mp4`);

    try {
        // 1. Download raw → temp file via streaming pipeline. Avoids buffering
        //    the entire video in memory.
        const stream = await r2.getObjectStream(rawKey);
        await pipeline(stream, createWriteStream(rawTempPath));

        // 2. Run ffmpeg. Throws on non-zero exit code.
        await transcodeToH264Mp4({
            inputPath: rawTempPath,
            outputPath: encodedTempPath,
        });

        // 3. Stat encoded for byte size + read into buffer for upload.
        const encodedStat = await fs.stat(encodedTempPath);
        const encodedBytes = await fs.readFile(encodedTempPath);

        // 4. Upload encoded → R2 at the canonical encoded key.
        const encodedKey = r2.encodedStorageKey(job.user_id, job.id);
        await r2.putObject(encodedKey, encodedBytes, 'video/mp4');

        // 5. DB: flip status to ready + record storage key + size.
        await userTagModel.markTranscodeReady(job.id, encodedKey, encodedStat.size);

        // 6. Best-effort cleanup of the raw object. Don't fail the whole
        //    job if R2 hiccups here — we already have the encoded variant.
        try {
            await r2.deleteObject(rawKey);
        } catch (err) {
            console.error(`⚠️  Failed to delete raw object ${rawKey} after successful encode:`, err);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Transcode failed for tag ${job.id}:`, message);
        await userTagModel.markTranscodeFailed(job.id, message);
    } finally {
        // Cleanup temp files. fs.rm with force=true is idempotent.
        await fs.rm(rawTempPath,     { force: true }).catch(() => {});
        await fs.rm(encodedTempPath, { force: true }).catch(() => {});
    }
}
