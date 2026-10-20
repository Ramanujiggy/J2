// pose — find the two people in a roll and follow them through the clip.
//
// Detection is RTMO-s (one-stage multi-person pose, OpenMMLab, Apache-2.0),
// run as ONNX on CPU. Ultralytics models are AGPL and stay out of
// production; see roadmap.md → Video: tap to pick the pair.
//
// Off-the-shelf detectors find two skeletons in almost every close frame of
// a roll but cannot tell *which* two people are rolling. The user answers
// that once: they tap themselves and their partner on one frame, and
// `trackPair` carries those two identities forward and backward from there.
//
// Coordinates everywhere in this file are normalised to the frame (0..1),
// so the client can draw on a video element of any size.

/** COCO-17 keypoint order, as RTMO emits it. */
export const KEYPOINT_COUNT = 17;

/** Limb pairs for drawing a skeleton (COCO-17 indices). */
export const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
    [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

export interface Person {
    /** [x0, y0, x1, y1], normalised. */
    box: [number, number, number, number];
    score: number;
    /** KEYPOINT_COUNT × [x, y, confidence], flattened; x/y normalised. */
    kp: number[];
}

export interface Point { x: number; y: number }

// ── Geometry ────────────────────────────────────────────────────────────────

export function iou(a: Person['box'], b: Person['box']): number {
    const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const inter = ix * iy;
    const union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return union > 0 ? inter / union : 0;
}

function boxDiag(b: Person['box']): number {
    return Math.hypot(b[2] - b[0], b[3] - b[1]);
}

/**
 * How unlike each other two detections are, 0 (same pose, same place) to
 * ~1+. Mean distance between keypoints both sides are confident about,
 * scaled by body size. Box overlap alone fails here: two grapplers'
 * boxes overlap almost completely for most of a roll, but their joints don't.
 */
export function poseDistance(a: Person, b: Person, minConf = 0.3): number {
    let sum = 0;
    let n = 0;
    for (let k = 0; k < KEYPOINT_COUNT; k++) {
        if ((a.kp[k * 3 + 2] ?? 0) < minConf || (b.kp[k * 3 + 2] ?? 0) < minConf) continue;
        sum += Math.hypot((a.kp[k * 3] ?? 0) - (b.kp[k * 3] ?? 0), (a.kp[k * 3 + 1] ?? 0) - (b.kp[k * 3 + 1] ?? 0));
        n++;
    }
    const scale = Math.max(boxDiag(a.box), boxDiag(b.box), 1e-3);
    if (n < 4) {
        // Too few shared joints to compare poses; fall back to box centres.
        const ca = [(a.box[0] + a.box[2]) / 2, (a.box[1] + a.box[3]) / 2];
        const cb = [(b.box[0] + b.box[2]) / 2, (b.box[1] + b.box[3]) / 2];
        return Math.hypot(ca[0]! - cb[0]!, ca[1]! - cb[1]!) / scale + 0.25;
    }
    return sum / n / scale;
}

/** The detection a tap most plausibly meant: the one whose box holds the
 *  point with a joint nearest to it; else the box whose edge is closest. */
export function personAt(people: Person[], p: Point): Person | null {
    let best: Person | null = null;
    let bestCost = Infinity;
    for (const person of people) {
        const [x0, y0, x1, y1] = person.box;
        const inside = p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        let nearestJoint = Infinity;
        for (let k = 0; k < KEYPOINT_COUNT; k++) {
            if ((person.kp[k * 3 + 2] ?? 0) < 0.3) continue;
            nearestJoint = Math.min(nearestJoint, Math.hypot((person.kp[k * 3] ?? 0) - p.x, (person.kp[k * 3 + 1] ?? 0) - p.y));
        }
        const edge = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(y0 - p.y, 0, p.y - y1));
        const cost = (inside ? 0 : 1 + edge) + Math.min(nearestJoint, 1);
        if (cost < bestCost) { bestCost = cost; best = person; }
    }
    return best;
}

// ── Tracking ────────────────────────────────────────────────────────────────

/** Beyond this pose distance a detection is not the same person... */
const MAX_MATCH_DISTANCE = 0.35;
/** ...but the longer someone has been unseen, the further they may have moved. */
const MAX_REACQUIRE_DISTANCE = 1.2;

/** How far from the tapped frame to look for one where both are visible. */
const SEED_WINDOW_FRAMES = 8;

function matchLimit(gap: number): number {
    return Math.min(MAX_REACQUIRE_DISTANCE, MAX_MATCH_DISTANCE * (1 + gap / 3));
}

/**
 * Follow the two tapped people through every frame.
 *
 * Starting from the seed frame, walk forward then backward. In each frame
 * the pair is matched jointly (A→i, B→j, i≠j) to the cheapest assignment,
 * so the two identities never collapse onto one detection when the
 * grapplers are tangled. A person missing from a frame is null there; their
 * last seen pose keeps anchoring the match, with a tolerance that widens
 * the longer they have been gone, so a track can pick them up again.
 */
export function trackPair(
    frames: Person[][],
    seedIndex: number,
    tapA: Point,
    tapB: Point,
): Array<[Person | null, Person | null]> {
    const out: Array<[Person | null, Person | null]> = frames.map(() => [null, null]);
    // The detector can miss one of a tangled pair on the very frame that was
    // tapped; people barely move in a second or two, so anchor on the
    // nearest frame where both can be told apart.
    let seed = seedIndex;
    for (let d = 0; d <= SEED_WINDOW_FRAMES; d++) {
        const hit = [seedIndex - d, seedIndex + d].find(f => (frames[f]?.length ?? 0) >= 2);
        if (hit !== undefined) { seed = hit; break; }
    }
    const seedPeople = frames[seed] ?? [];
    const a0 = personAt(seedPeople, tapA);
    const b0 = personAt(seedPeople.filter(p => p !== a0), tapB);
    if (!a0 && !b0) return out;
    out[seed] = [a0, b0];

    for (const step of [1, -1] as const) {
        let lastA = a0, lastB = b0;
        let gapA = 0, gapB = 0;
        for (let f = seed + step; f >= 0 && f < frames.length; f += step) {
            const [a, b] = matchPair(frames[f] ?? [], lastA, gapA, lastB, gapB);
            out[f] = [a, b];
            if (a) { lastA = a; gapA = 0; } else gapA++;
            if (b) { lastB = b; gapB = 0; } else gapB++;
        }
    }
    return out;
}

function matchPair(
    people: Person[],
    prevA: Person | null, gapA: number,
    prevB: Person | null, gapB: number,
): [Person | null, Person | null] {
    const cost = (prev: Person | null, gap: number, cand: Person | null): number => {
        // Never tapped (one of the two was not found on the seed frame):
        // nothing to follow, so stay empty rather than adopt a stranger.
        if (!prev) return cand ? Infinity : 0;
        const limit = matchLimit(gap);
        if (!cand) return limit;
        const ratio = boxDiag(cand.box) / Math.max(boxDiag(prev.box), 1e-3);
        if (ratio > MAX_SIZE_RATIO || ratio < 1 / MAX_SIZE_RATIO) return Infinity;
        const d = poseDistance(prev, cand);
        return d > limit ? Infinity : d;
    };
    const options: Array<Person | null> = [null, ...people];
    let best: [Person | null, Person | null] = [null, null];
    let bestCost = Infinity;
    for (const a of options) {
        for (const b of options) {
            if (a && a === b) continue;
            // They are rolling, so they stay within reach of each other. A
            // candidate far from the partner is a bystander, however much
            // their pose resembles the one being followed.
            if (a && !withinReach(a, b ?? prevB)) continue;
            if (b && !withinReach(b, a ?? prevA)) continue;
            const c = cost(prevA, gapA, a) + cost(prevB, gapB, b);
            if (c < bestCost) { bestCost = c; best = [a, b]; }
        }
    }
    return best;
}

/** Partners' boxes touch or nearly touch: centres within about one body
 *  length of the smaller of the two, so a tall bystander's big box does not
 *  stretch the reach. */
export function withinReach(p: Person, partner: Person | null): boolean {
    if (!partner) return true;
    const dx = (p.box[0] + p.box[2]) / 2 - (partner.box[0] + partner.box[2]) / 2;
    const dy = (p.box[1] + p.box[3]) / 2 - (partner.box[1] + partner.box[3]) / 2;
    return Math.hypot(dx, dy) <= REACH * Math.min(boxDiag(p.box), boxDiag(partner.box));
}
const REACH = 1.0;
/** A person does not double or halve in size between nearby frames. */
const MAX_SIZE_RATIO = 2;

// ── Follow-cam regions ──────────────────────────────────────────────────────

export interface Region { x0: number; y0: number; x1: number; y1: number }

export const FULL_FRAME: Region = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * Per frame, the part of the picture worth looking at closely: the pair's
 * combined box from a first full-frame pass, padded, with gaps filled from
 * the nearest frame that had them. Running the detector on that crop makes
 * a pair at the far side of the mat several times larger in the model's
 * 640px input and leaves bystanders out of frame.
 */
export function followRegions(track: Array<[Person | null, Person | null]>, pad = 0.4, minSide = 0.2): Region[] {
    const raw: Array<Region | null> = track.map(([a, b]) => {
        const boxes = [a?.box, b?.box].filter((x): x is Person['box'] => !!x);
        if (boxes.length === 0) return null;
        return {
            x0: Math.min(...boxes.map(x => x[0])), y0: Math.min(...boxes.map(x => x[1])),
            x1: Math.max(...boxes.map(x => x[2])), y1: Math.max(...boxes.map(x => x[3])),
        };
    });
    const out: Region[] = [];
    for (let i = 0; i < raw.length; i++) {
        let r = raw[i] ?? null;
        for (let d = 1; !r && (i - d >= 0 || i + d < raw.length); d++) {
            r = raw[i - d] ?? raw[i + d] ?? null;
        }
        if (!r) { out.push(FULL_FRAME); continue; }
        const w = Math.max(r.x1 - r.x0, minSide) * (1 + 2 * pad);
        const h = Math.max(r.y1 - r.y0, minSide) * (1 + 2 * pad);
        const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
        out.push({
            x0: Math.max(0, cx - w / 2), y0: Math.max(0, cy - h / 2),
            x1: Math.min(1, cx + w / 2), y1: Math.min(1, cy + h / 2),
        });
    }
    return out;
}

// ── Compact storage ─────────────────────────────────────────────────────────

/** One stored skeleton: KEYPOINT_COUNT × [x‰, y‰, confidence%], integers.
 *  About 4× smaller than raw floats in JSON, far below drawing precision. */
export type PackedSkeleton = number[];

export function packSkeleton(p: Person | null): PackedSkeleton | null {
    if (!p) return null;
    const out: number[] = [];
    for (let k = 0; k < KEYPOINT_COUNT; k++) {
        out.push(
            Math.round((p.kp[k * 3] ?? 0) * 1000),
            Math.round((p.kp[k * 3 + 1] ?? 0) * 1000),
            Math.round((p.kp[k * 3 + 2] ?? 0) * 100),
        );
    }
    return out;
}

// ── RTMO inference ──────────────────────────────────────────────────────────

/** RTMO's fixed input side. Inputs are scaled to fit inside it and padded
 *  bottom/right with grey 114, as the model was trained. */
export const MODEL_INPUT = 640;

/** The subset of onnxruntime's session API used here, so this file stays
 *  testable without the native binding. */
export interface PoseModel {
    run(feeds: Record<string, unknown>): Promise<Record<string, { data: ArrayLike<number>; dims: readonly number[] }>>;
}
export type TensorFactory = (data: Float32Array, dims: number[]) => unknown;

/**
 * People in one frame, or in `region` of it. `bgr` is a w×h packed BGR24
 * frame. The region is scaled to fit MODEL_INPUT (bilinear), padded
 * bottom/right; results come back normalised to the whole frame.
 * `input` is a reusable 3×640×640 buffer to avoid reallocating per frame.
 */
export async function detectPeople(
    model: PoseModel,
    tensor: TensorFactory,
    bgr: Uint8Array,
    w: number,
    h: number,
    input: Float32Array,
    region: Region = FULL_FRAME,
    minScore = 0.3,
): Promise<Person[]> {
    const plane = MODEL_INPUT * MODEL_INPUT;
    const rx = region.x0 * w, ry = region.y0 * h;
    const rw = Math.max(1, (region.x1 - region.x0) * w), rh = Math.max(1, (region.y1 - region.y0) * h);
    const scale = MODEL_INPUT / Math.max(rw, rh);
    const outW = Math.min(MODEL_INPUT, Math.round(rw * scale));
    const outH = Math.min(MODEL_INPUT, Math.round(rh * scale));

    input.fill(114);
    for (let y = 0; y < outH; y++) {
        const sy = Math.min(h - 1, Math.max(0, ry + (y + 0.5) / scale - 0.5));
        const y0 = Math.floor(sy), y1 = Math.min(h - 1, y0 + 1), fy = sy - y0;
        for (let x = 0; x < outW; x++) {
            const sx = Math.min(w - 1, Math.max(0, rx + (x + 0.5) / scale - 0.5));
            const x0 = Math.floor(sx), x1 = Math.min(w - 1, x0 + 1), fx = sx - x0;
            const p00 = (y0 * w + x0) * 3, p01 = (y0 * w + x1) * 3, p10 = (y1 * w + x0) * 3, p11 = (y1 * w + x1) * 3;
            const dst = y * MODEL_INPUT + x;
            for (let c = 0; c < 3; c++) {
                const top = bgr[p00 + c]! + (bgr[p01 + c]! - bgr[p00 + c]!) * fx;
                const bot = bgr[p10 + c]! + (bgr[p11 + c]! - bgr[p10 + c]!) * fx;
                input[c * plane + dst] = top + (bot - top) * fy;
            }
        }
    }
    const out = await model.run({ input: tensor(input, [1, 3, MODEL_INPUT, MODEL_INPUT]) });
    const dets = out['dets'];
    const kps = out['keypoints'];
    if (!dets || !kps) throw new Error('Pose model returned no dets/keypoints output.');

    const nx = (v: number) => (rx + v / scale) / w;
    const ny = (v: number) => (ry + v / scale) / h;
    const people: Person[] = [];
    const n = dets.dims[1] ?? 0;
    for (let i = 0; i < n; i++) {
        const score = dets.data[i * 5 + 4] ?? 0;
        if (score < minScore) continue;
        const kp: number[] = [];
        for (let k = 0; k < KEYPOINT_COUNT; k++) {
            const base = (i * KEYPOINT_COUNT + k) * 3;
            kp.push(nx(kps.data[base] ?? 0), ny(kps.data[base + 1] ?? 0), kps.data[base + 2] ?? 0);
        }
        people.push({
            box: [nx(dets.data[i * 5] ?? 0), ny(dets.data[i * 5 + 1] ?? 0), nx(dets.data[i * 5 + 2] ?? 0), ny(dets.data[i * 5 + 3] ?? 0)],
            score,
            kp,
        });
    }
    return people;
}

/** Frame size that fits inside `side` keeping aspect; even numbers for ffmpeg. */
export function fitWithin(width: number, height: number, side = MODEL_INPUT): { w: number; h: number } {
    const s = Math.min(1, side / Math.max(width, height));
    const even = (v: number) => Math.max(2, Math.floor(v / 2) * 2);
    return { w: even(width * s), h: even(height * s) };
}
