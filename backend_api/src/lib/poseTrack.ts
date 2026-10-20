// poseTrack — run the pose pipeline over a whole clip.
//
//   1. Probe the clip (display size after rotation).
//   2. Pass one: decode at 640px, detect everyone, follow the tapped pair.
//   3. Pass two: decode at up to 1280px, detect again inside a padded box
//      around the pair (the "follow cam"), follow the pair again.
//   4. Pack the two skeletons per frame for storage.
//
// Pass two is what makes a pair on the far side of the mat usable: the model
// input is a fixed 640px, so a full frame shrinks a distant pair to a few
// dozen pixels, while the crop gives them most of it.

import { spawn } from 'node:child_process';
import {
    detectPeople, fitWithin, followRegions, packSkeleton, trackPair, MODEL_INPUT,
    type PackedSkeleton, type Person, type Point, type PoseModel, type Region, type TensorFactory,
} from './pose.js';

export interface PairTrack {
    fps: number;
    /** Per sampled frame: [tapped first, tapped second]; null where not found. */
    frames: Array<[PackedSkeleton | null, PackedSkeleton | null]>;
}

export interface TrackOptions {
    model: PoseModel;
    tensor: TensorFactory;
    inputPath: string;
    seedSec: number;
    tapA: Point;
    tapB: Point;
    fps?: number;
    ffmpegBinary?: string;
    ffprobeBinary?: string;
}

export async function trackVideoPair(opts: TrackOptions): Promise<PairTrack> {
    const fps = opts.fps ?? 4;
    const { width, height } = await probeDisplaySize(opts.inputPath, opts.ffprobeBinary);
    const seedIndex = Math.max(0, Math.round(opts.seedSec * fps));
    const input = new Float32Array(3 * MODEL_INPUT * MODEL_INPUT);

    const small = fitWithin(width, height);
    const pass1: Person[][] = [];
    await forEachFrame(opts.inputPath, fps, small.w, small.h, opts.ffmpegBinary, async (bgr) => {
        pass1.push(await detectPeople(opts.model, opts.tensor, bgr, small.w, small.h, input));
    });
    const seed = Math.min(seedIndex, Math.max(0, pass1.length - 1));
    const regions: Region[] = followRegions(trackPair(pass1, seed, opts.tapA, opts.tapB));

    const large = fitWithin(width, height, MODEL_INPUT * 2);
    const pass2: Person[][] = [];
    await forEachFrame(opts.inputPath, fps, large.w, large.h, opts.ffmpegBinary, async (bgr, i) => {
        pass2.push(await detectPeople(opts.model, opts.tensor, bgr, large.w, large.h, input, regions[i]));
    });

    const track = trackPair(pass2, Math.min(seed, Math.max(0, pass2.length - 1)), opts.tapA, opts.tapB);
    return { fps, frames: track.map(([a, b]) => [packSkeleton(a), packSkeleton(b)]) };
}

/** Width/height as displayed, honouring a phone's rotation metadata. */
export async function probeDisplaySize(inputPath: string, ffprobe = 'ffprobe'): Promise<{ width: number; height: number }> {
    const out = await collect(ffprobe, [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height:stream_side_data=rotation:stream_tags=rotate',
        '-of', 'json', inputPath,
    ]);
    const stream = (JSON.parse(out) as { streams?: Array<{ width?: number; height?: number; side_data_list?: Array<{ rotation?: number }>; tags?: { rotate?: string } }> }).streams?.[0];
    if (!stream?.width || !stream.height) throw new Error('Could not read the video size.');
    const rotation = Number(stream.side_data_list?.find(d => d.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0);
    return Math.abs(rotation) % 180 === 90
        ? { width: stream.height, height: stream.width }
        : { width: stream.width, height: stream.height };
}

/** Decode at `fps`, scaled to w×h, handing each BGR24 frame over in order.
 *  Streams, so memory stays at one frame however long the roll is. */
async function forEachFrame(
    inputPath: string, fps: number, w: number, h: number, ffmpeg = 'ffmpeg',
    onFrame: (bgr: Uint8Array, index: number) => Promise<void>,
): Promise<void> {
    const child = spawn(ffmpeg, [
        '-v', 'error', '-i', inputPath,
        '-vf', `fps=${fps},scale=${w}:${h}`,
        '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (c: Buffer) => { stderr = (stderr + c.toString('utf-8')).slice(-4000); });
    const exited = new Promise<number | null>((resolve, reject) => {
        child.once('error', err => reject(new Error(`ffmpeg failed to launch: ${err.message}`)));
        child.once('close', resolve);
    });

    const size = w * h * 3;
    let pending: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let index = 0;
    for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
        pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
        while (pending.length >= size) {
            await onFrame(pending.subarray(0, size), index++);
            pending = pending.subarray(size);
        }
    }
    const code = await exited;
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}: ${stderr.trim().split('\n').slice(-3).join(' ')}`);
}

function collect(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', (c: Buffer) => { out += c.toString('utf-8'); });
        child.once('error', err => reject(new Error(`${cmd} failed to launch: ${err.message}`)));
        child.once('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited with code ${code}`)));
    });
}
