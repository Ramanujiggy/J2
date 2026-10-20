import { describe, it, expect } from 'vitest';
import {
    detectPeople, followRegions, packSkeleton, personAt, trackPair, MODEL_INPUT,
    type Person, type PoseModel,
} from '../src/lib/pose.js';

// A crude standing figure: 17 joints spread over a box centred at (cx, cy).
function person(cx: number, cy: number, size = 0.2, lean = 0): Person {
    const kp: number[] = [];
    for (let k = 0; k < 17; k++) {
        const row = Math.floor(k / 3) / 6 - 0.5;
        const col = ((k % 3) - 1) / 2;
        kp.push(cx + (col + lean * row) * size * 0.4, cy + row * size, 0.9);
    }
    return { box: [cx - size / 4, cy - size / 2, cx + size / 4, cy + size / 2], score: 0.9, kp };
}

describe('personAt', () => {
    it('picks the detection whose box holds the tap', () => {
        const left = person(0.3, 0.5), right = person(0.7, 0.5);
        expect(personAt([left, right], { x: 0.71, y: 0.52 })).toBe(right);
        expect(personAt([left, right], { x: 0.29, y: 0.4 })).toBe(left);
    });
});

describe('trackPair', () => {
    it('keeps identities when detection order flips from frame to frame', () => {
        const frames: Person[][] = [];
        for (let f = 0; f < 10; f++) {
            const a = person(0.40 + f * 0.005, 0.5), b = person(0.52 - f * 0.005, 0.5, 0.2, 0.3);
            frames.push(f % 2 ? [a, b] : [b, a]);
        }
        const t = trackPair(frames, 3, { x: 0.415, y: 0.5 }, { x: 0.505, y: 0.5 });
        t.forEach(([a, b], f) => {
            expect(a!.box[0]).toBeCloseTo(0.40 + f * 0.005 - 0.05, 5);
            expect(b!.box[0]).toBeCloseTo(0.52 - f * 0.005 - 0.05, 5);
        });
    });

    it('leaves a gap rather than jumping to a bystander across the mat', () => {
        const a = person(0.40, 0.5), b = person(0.5, 0.5, 0.2, 0.3), bystander = person(0.9, 0.5, 0.2, 0.3);
        const frames = [[a, b], [a, bystander], [a, bystander], [a, b]];
        const t = trackPair(frames, 0, { x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 });
        expect(t[1]![1]).toBeNull();
        expect(t[2]![1]).toBeNull();
        expect(t[3]![1]).toBe(b);
    });

    it('anchors on a nearby frame when the tapped frame shows only one of them', () => {
        const a = person(0.40, 0.5), b = person(0.5, 0.5, 0.2, 0.3);
        const frames = [[a, b], [a], [a, b]];
        const t = trackPair(frames, 1, { x: 0.4, y: 0.5 }, { x: 0.5, y: 0.5 });
        expect(t[0]).toEqual([a, b]);
        expect(t[2]).toEqual([a, b]);
    });

    it('returns empty frames when nobody is near the taps', () => {
        expect(trackPair([[], []], 0, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 })).toEqual([[null, null], [null, null]]);
    });
});

describe('followRegions', () => {
    it('pads the pair box, fills gaps from neighbours and stays inside the frame', () => {
        const a = person(0.1, 0.5), b = person(0.2, 0.5);
        const r = followRegions([[a, b], [null, null], [a, null]]);
        expect(r[0]!.x0).toBe(0);
        expect(r[0]!.x1).toBeGreaterThan(0.25);
        expect(r[1]).toEqual(r[0]);
        expect(r[0]!.y0).toBeGreaterThanOrEqual(0);
        expect(r[0]!.y1).toBeLessThanOrEqual(1);
    });
});

describe('packSkeleton', () => {
    it('stores per-mille positions and percent confidence', () => {
        const packed = packSkeleton(person(0.5, 0.5))!;
        expect(packed).toHaveLength(51);
        expect(packed.every(Number.isInteger)).toBe(true);
        expect(packed[2]).toBe(90);
        expect(packSkeleton(null)).toBeNull();
    });
});

describe('detectPeople', () => {
    it('maps detections in a cropped region back to whole-frame coordinates', async () => {
        // The fake model "sees" one person centred in its 640px input.
        const c = MODEL_INPUT / 2;
        const model: PoseModel = {
            run: async () => ({
                dets: { data: [c - 10, c - 20, c + 10, c + 20, 0.8], dims: [1, 1, 5] },
                keypoints: { data: Array.from({ length: 17 }, () => [c, c, 0.9]).flat(), dims: [1, 1, 17, 3] },
            }),
        };
        const w = 200, h = 100;
        const people = await detectPeople(model, d => d, new Uint8Array(w * h * 3), w, h,
            new Float32Array(3 * MODEL_INPUT * MODEL_INPUT), { x0: 0.5, y0: 0.5, x1: 1, y1: 1 });
        expect(people).toHaveLength(1);
        // Region is the bottom-right quarter (100×50 px), scaled 6.4× into the
        // input; the input centre is 50px across / 50px down that region.
        expect(people[0]!.kp[0]).toBeCloseTo((100 + c / 6.4) / w, 5);
        expect(people[0]!.kp[1]).toBeCloseTo((50 + c / 6.4) / h, 5);
    });
});
