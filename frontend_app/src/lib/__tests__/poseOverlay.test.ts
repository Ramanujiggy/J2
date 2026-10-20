import { describe, it, expect } from 'vitest';
import { contentRect, coverage, pairAt, tapToFrame } from '../poseOverlay.ts';

const skel = (v: number) => Array.from({ length: 51 }, (_, k) => (k % 3 === 2 ? 90 : v));

describe('contentRect', () => {
  it('letterboxes a portrait video inside a wide box', () => {
    expect(contentRect(1080, 1920, { width: 400, height: 200 })).toEqual({ x: 143.75, y: 0, width: 112.5, height: 200 });
  });
});

describe('tapToFrame', () => {
  const c = { x: 100, y: 0, width: 200, height: 100 };
  it('maps a tap on the picture to 0..1', () => {
    expect(tapToFrame(150, 25, c)).toEqual({ x: 0.25, y: 0.25 });
  });
  it('ignores taps on the letterbox', () => {
    expect(tapToFrame(50, 25, c)).toBeNull();
  });
});

describe('pairAt', () => {
  const track = { fps: 4, frames: [[skel(100), skel(500)], [skel(200), null]] as Array<[number[] | null, number[] | null]> };

  it('blends between samples', () => {
    const [you] = pairAt(track, 0.125); // halfway between t=0 and t=0.25
    expect(you![0]).toBe(150);
  });

  it('shows a person missing from the next sample only near the sample that has them', () => {
    expect(pairAt(track, 0.05)[1]).not.toBeNull();
    expect(pairAt(track, 0.2)[1]).toBeNull();
  });

  it('clamps past the ends and copes with no data', () => {
    expect(pairAt(track, 99)[0]![0]).toBe(200);
    expect(pairAt({ fps: null, frames: null }, 1)).toEqual([null, null]);
  });
});

describe('coverage', () => {
  it('is the share of samples with both people', () => {
    expect(coverage({ frames: [[skel(1), skel(1)], [skel(1), null]] })).toBe(0.5);
  });
});
