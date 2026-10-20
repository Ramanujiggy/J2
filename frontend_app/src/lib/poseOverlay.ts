// poseOverlay — drawing the pair's skeletons over a <video>.
//
// Tracks arrive as packed integer skeletons sampled a few times a second
// (see PoseTrack in types/api.ts). These helpers map between the video's
// own pixels and the element showing it (object-fit: contain letterboxes),
// and interpolate between samples so the overlay moves smoothly at 60fps.

import type { PackedSkeleton, PoseTrack } from '../types/api.ts';

/** COCO-17 limbs. Face points (0–4) are left out: at grappling distances they
 *  are noise, and a face drawn over a face reads as a mask. */
export const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

/** Below this confidence (%) a joint is not drawn. */
export const MIN_JOINT_CONFIDENCE = 30;

export interface Rect { x: number; y: number; width: number; height: number }

/** Where the picture actually sits inside an object-fit: contain box. */
export function contentRect(videoWidth: number, videoHeight: number, box: { width: number; height: number }): Rect {
  if (!videoWidth || !videoHeight || !box.width || !box.height) return { x: 0, y: 0, width: box.width, height: box.height };
  const scale = Math.min(box.width / videoWidth, box.height / videoHeight);
  const width = videoWidth * scale, height = videoHeight * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** A tap at (x, y) inside the element → a point on the picture (0..1), or
 *  null when it lands on the letterbox. */
export function tapToFrame(x: number, y: number, content: Rect): { x: number; y: number } | null {
  const nx = (x - content.x) / content.width, ny = (y - content.y) / content.height;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { x: nx, y: ny };
}

/** The pair at time t, blended between the two nearest samples. A person
 *  missing from either neighbour shows only when t is close to the sample
 *  that has them, so a gap reads as a gap instead of a frozen pose. */
export function pairAt(track: Pick<PoseTrack, 'fps' | 'frames'>, t: number): [PackedSkeleton | null, PackedSkeleton | null] {
  const frames = track.frames, fps = track.fps;
  if (!frames || frames.length === 0 || !fps) return [null, null];
  const pos = Math.max(0, Math.min(frames.length - 1, t * fps));
  const i = Math.floor(pos), f = pos - i;
  const a = frames[i], b = frames[Math.min(frames.length - 1, i + 1)];
  if (!a || !b) return [null, null];
  return [blend(a[0], b[0], f), blend(a[1], b[1], f)];
}

function blend(p: PackedSkeleton | null, q: PackedSkeleton | null, f: number): PackedSkeleton | null {
  if (p && q) return p.map((v, k) => v + ((q[k] ?? v) - v) * f);
  if (p && f < 0.5) return p;
  if (q && f >= 0.5) return q;
  return null;
}

/** Draw one skeleton: limbs, then joints. Coordinates map onto `content`. */
export function drawSkeleton(ctx: CanvasRenderingContext2D, s: PackedSkeleton, content: Rect, color: string, glow: string): void {
  const px = (k: number) => content.x + ((s[k * 3] ?? 0) / 1000) * content.width;
  const py = (k: number) => content.y + ((s[k * 3 + 1] ?? 0) / 1000) * content.height;
  const ok = (k: number) => (s[k * 3 + 2] ?? 0) >= MIN_JOINT_CONFIDENCE;
  const line = Math.max(2, content.width / 220);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = line;
  ctx.lineCap = 'round';
  ctx.shadowColor = glow;
  ctx.shadowBlur = line * 3;
  for (const [a, b] of SKELETON_EDGES) {
    if (!ok(a) || !ok(b)) continue;
    ctx.beginPath();
    ctx.moveTo(px(a), py(a));
    ctx.lineTo(px(b), py(b));
    ctx.stroke();
  }
  for (let k = 5; k < 17; k++) {
    if (!ok(k)) continue;
    ctx.beginPath();
    ctx.arc(px(k), py(k), line * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Share of samples where both people were found, 0..1. */
export function coverage(track: Pick<PoseTrack, 'frames'>): number {
  const frames = track.frames ?? [];
  if (frames.length === 0) return 0;
  return frames.filter(([a, b]) => a && b).length / frames.length;
}
