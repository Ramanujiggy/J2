// PairTrackedVideo — the review video, with the two people in the roll
// picked out and followed.
//
// States, shown in the line under the video:
//   none     → "Pick you and your partner"
//   picking  → video paused, "Tap yourself", then "Now tap your partner"
//   pending  → "Following you two through the roll…" (polls)
//   ready    → skeletons drawn over the video; "Skeletons" toggle + "Re-pick"
//   failed   → "Couldn't follow you two in this clip" + "Try again"
//
// The tap is the whole interface: off-the-shelf pose models find the
// people but can't tell which two are rolling. Once picked, a background
// job follows them (backend_api/src/workers/poseWorker.ts).

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { api } from '../lib/api.ts';
import { contentRect, coverage, drawSkeleton, pairAt, tapToFrame } from '../lib/poseOverlay.ts';
import {
  BRAND_ORANGE, COPPER, PAIR_PARTNER, PAIR_PARTNER_GLOW, PAIR_YOU, PAIR_YOU_GLOW,
  STATUS_ERROR, TEXT_SECONDARY, TEXT_TERTIARY,
} from '../lib/theme.ts';
import type { PoseTrack } from '../types/api.ts';

const POLL_MS = 5000;

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  videoUrl: string;
  sessionId: string;
  videoId: string;
  /** Style for the <video> element itself (size, radius). */
  videoStyle: React.CSSProperties;
}

type Pick = { first: { x: number; y: number } | null; seedSec: number };

export default function PairTrackedVideo({ videoRef, videoUrl, sessionId, videoId, videoStyle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [track, setTrack] = useState<PoseTrack | null | undefined>(undefined);
  const [pick, setPick] = useState<Pick | null>(null);
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/sessions/${sessionId}/videos/${videoId}`;

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ track: PoseTrack | null }>(`${base}/pose`);
      setTrack(data.track);
    } catch { setTrack(null); }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (track?.status !== 'pending') return;
    const t = setTimeout(() => { void load(); }, POLL_MS);
    return () => clearTimeout(t);
  }, [track, load]);

  // Draw loop: redraw every animation frame while there is something to show.
  const drawing = track?.status === 'ready' && showSkeletons && !pick;
  useEffect(() => {
    const canvas = canvasRef.current, video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!drawing || !track) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    let raf = 0;
    const draw = () => {
      const box = video.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) {
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      const content = contentRect(video.videoWidth, video.videoHeight, box);
      const [you, partner] = pairAt(track, video.currentTime);
      if (partner) drawSkeleton(ctx, partner, content, PAIR_PARTNER, PAIR_PARTNER_GLOW);
      if (you) drawSkeleton(ctx, you, content, PAIR_YOU, PAIR_YOU_GLOW);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [drawing, track, videoRef]);

  const startPick = () => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setError(null);
    setPick({ first: null, seedSec: v.currentTime });
  };

  const onTap = async (e: React.PointerEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !pick) return;
    const box = v.getBoundingClientRect();
    const point = tapToFrame(e.clientX - box.left, e.clientY - box.top, contentRect(v.videoWidth, v.videoHeight, box));
    if (!point) return;
    if (!pick.first) { setPick({ ...pick, first: point }); return; }
    setPick(null);
    try {
      await api.put(`${base}/pair`, { seed_sec: pick.seedSec, first: pick.first, second: point });
      setTrack({ status: 'pending', message: null, fps: null, frames: null });
    } catch {
      setError('That pick did not save. Try again.');
    }
  };

  const pct = track?.status === 'ready' ? Math.round(coverage(track) * 100) : 0;

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <video ref={videoRef} src={videoUrl} controls={!pick} playsInline style={videoStyle} />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        {pick && (
          <div
            role="button"
            aria-label={pick.first ? 'Tap your partner' : 'Tap yourself'}
            onPointerUp={onTap}
            className="touch-manipulation"
            style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
          >
            {pick.first && <TapMark x={pick.first.x} y={pick.first.y} videoRef={videoRef} />}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 6 }}>
        <PairStatus track={track} pick={pick} pct={pct} />
        <div style={{ flex: 1 }} />
        {pick ? (
          <LineButton onClick={() => setPick(null)} color={TEXT_TERTIARY}>Cancel</LineButton>
        ) : track === undefined || track?.status === 'pending' ? null : track?.status === 'ready' ? (
          <>
            <LineButton onClick={() => setShowSkeletons(s => !s)} color={showSkeletons ? COPPER : TEXT_TERTIARY} pressed={showSkeletons}>
              Skeletons
            </LineButton>
            <LineButton onClick={startPick} color={TEXT_TERTIARY}>Re-pick</LineButton>
          </>
        ) : (
          <LineButton onClick={startPick} color={BRAND_ORANGE}>
            {track?.status === 'failed' ? 'Try again' : 'Pick you and your partner'}
          </LineButton>
        )}
      </div>
      {error && <p style={{ fontSize: 12, color: STATUS_ERROR, margin: 0 }}>{error}</p>}
    </div>
  );
}

function PairStatus({ track, pick, pct }: { track: PoseTrack | null | undefined; pick: Pick | null; pct: number }) {
  const text = pick
    ? (pick.first ? 'Now tap your partner' : 'Tap yourself')
    : track?.status === 'pending' ? 'Following you two through the roll…'
    : track?.status === 'failed' ? 'Couldn’t follow you two in this clip.'
    : track?.status === 'ready' ? `Both of you found in ${pct}% of the roll`
    : null;
  if (!text) return null;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: pick ? PAIR_YOU : TEXT_SECONDARY }}>
      {track?.status === 'ready' && !pick && (
        <>
          <Swatch color={PAIR_YOU} label="You" />
          <Swatch color={PAIR_PARTNER} label="Partner" />
        </>
      )}
      <span>{text}</span>
    </span>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span title={label} aria-label={label} style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
  );
}

function TapMark({ x, y, videoRef }: { x: number; y: number; videoRef: RefObject<HTMLVideoElement> }) {
  const v = videoRef.current;
  if (!v) return null;
  const box = v.getBoundingClientRect();
  const c = contentRect(v.videoWidth, v.videoHeight, box);
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', left: c.x + x * c.width - 9, top: c.y + y * c.height - 9,
        width: 18, height: 18, borderRadius: 9,
        border: `2px solid ${PAIR_YOU}`, boxShadow: `0 0 10px ${PAIR_YOU_GLOW}`,
      }}
    />
  );
}

function LineButton({ onClick, color, pressed, children }: {
  onClick: () => void; color: string; pressed?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="touch-manipulation"
      style={{
        minHeight: 44, padding: '0 10px', background: 'none', border: 'none', cursor: 'pointer',
        color, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
