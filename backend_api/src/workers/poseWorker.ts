// poseWorker — in-process polling worker that follows the tapped pair
// through a session video and stores their skeletons (mig 041).
//
// Pipeline per job:
//   1. Claim the next pending track whose video is transcoded.
//   2. Download the encoded MP4 from R2 → temp file.
//   3. trackVideoPair (lib/poseTrack.ts): two ffmpeg decode passes, RTMO-s
//      on each sampled frame, follow the pair from the tapped frame.
//   4. Store fps + packed frames; status='ready'.
//
// The model (RTMO-s, ~40MB ONNX) is fetched once into the temp dir and
// checked against a pinned SHA-256 before it is loaded. POSE_MODEL_PATH
// points at a local copy instead (dev, or an image that bakes it in).
//
// CPU-bound: a 5-minute roll at 4 fps is ~2,400 inferences across both
// passes, a few minutes on two threads. One job at a time, two threads, so
// the API keeps answering while it runs. Set POSE_WORKER=off to disable.

import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import * as sessionVideoModel from '../models/sessionVideoModel.js';
import * as r2 from '../lib/r2Client.js';
import { trackVideoPair } from '../lib/poseTrack.js';
import type { PoseModel, TensorFactory } from '../lib/pose.js';

const MODEL_NAME = 'rtmo-s';
// Community ONNX export of OpenMMLab's RTMO-s (Apache-2.0). Pinned by hash:
// a different file at this URL is refused, not loaded.
const MODEL_URL = 'https://github.com/jamjamjon/assets/releases/download/v0.0.1/rtmo-s-dyn.onnx';
const MODEL_SHA256 = '1cd6a3517658903233e9ccb78666554862f57f0944b6886e2048093594aef4e7';

const SAMPLE_FPS = 4;
const POLL_INTERVAL_MS = 10_000;
const ERROR_BACKOFF_MS = 60_000;

let running = false;
let stopped = false;
let timer: NodeJS.Timeout | null = null;
let loaded: Promise<{ model: PoseModel; tensor: TensorFactory }> | null = null;

export async function startPoseWorker(): Promise<() => Promise<void>> {
    if (running || process.env['POSE_WORKER'] === 'off') return async () => {};
    running = true;
    stopped = false;
    console.log('✅ Pose worker booting');
    schedule(0);
    return async () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        running = false;
    };
}

function schedule(ms: number): void {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void tick(); }, ms);
}

async function tick(): Promise<void> {
    let next = POLL_INTERVAL_MS;
    try {
        const job = await sessionVideoModel.claimNextPoseJob();
        if (job) {
            next = 100;
            await runJob(job);
        }
    } catch (err) {
        console.error('❌ Pose worker tick error:', err);
        next = ERROR_BACKOFF_MS;
    } finally {
        schedule(next);
    }
}

async function runJob(job: sessionVideoModel.PoseTrack & { video_storage_key: string }): Promise<void> {
    const claimedAt = job.processing_started_at!;
    const videoPath = path.join(tmpdir(), `j2-pose-${job.video_id}-${randomUUID().slice(0, 8)}.mp4`);
    const started = Date.now();
    try {
        const { model, tensor } = await loadModel();
        await pipeline(await r2.getObjectStream(job.video_storage_key), createWriteStream(videoPath));
        const track = await trackVideoPair({
            model, tensor, inputPath: videoPath, fps: SAMPLE_FPS,
            seedSec: job.seed_sec,
            tapA: { x: job.first_x, y: job.first_y },
            tapB: { x: job.second_x, y: job.second_y },
        });
        await sessionVideoModel.markPoseTrackReady(job.video_id, claimedAt, { ...track, model: MODEL_NAME });
        const both = track.frames.filter(([a, b]) => a && b).length;
        console.log(`✅ Pose track ${job.video_id}: ${track.frames.length} frames, both found in ${both}, ${((Date.now() - started) / 1000).toFixed(0)}s`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`❌ Pose track failed for ${job.video_id}:`, message);
        await sessionVideoModel.markPoseTrackFailed(job.video_id, claimedAt, message);
    } finally {
        await fs.rm(videoPath, { force: true }).catch(() => {});
    }
}

function loadModel(): Promise<{ model: PoseModel; tensor: TensorFactory }> {
    loaded ??= (async () => {
        const ort = await import('onnxruntime-node');
        const modelPath = process.env['POSE_MODEL_PATH'] ?? await fetchModel();
        const session = await ort.InferenceSession.create(modelPath, { intraOpNumThreads: 2, interOpNumThreads: 1 });
        const tensor: TensorFactory = (data, dims) => new ort.Tensor('float32', data, dims);
        return { model: session as unknown as PoseModel, tensor };
    })().catch((err: unknown) => {
        loaded = null; // let the next job try again
        throw err;
    });
    return loaded;
}

async function fetchModel(): Promise<string> {
    const target = path.join(tmpdir(), `j2-${MODEL_NAME}-${MODEL_SHA256.slice(0, 12)}.onnx`);
    const existing = await fs.readFile(target).catch(() => null);
    if (existing && sha256(existing) === MODEL_SHA256) return target;

    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`Pose model download failed: HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sha256(bytes) !== MODEL_SHA256) throw new Error('Pose model download did not match its pinned hash.');
    await fs.writeFile(target, bytes);
    return target;
}

function sha256(b: Buffer): string {
    return createHash('sha256').update(b).digest('hex');
}
