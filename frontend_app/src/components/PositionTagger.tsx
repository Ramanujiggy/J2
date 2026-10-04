// PositionTagger — interactive position-labelling interface for rolling footage.
//
// The user watches their video and taps a position button whenever the
// position changes. Each tap closes the current segment at `video.currentTime`
// and opens a new one. The result is a timeline of position_segments that feeds
// the data flywheel (Phase 2: model-pre-filled segments that users correct).

import { useState, useRef, useEffect, useCallback } from 'react';
import { BRAND_ORANGE, COPPER, PALE_YELLOW, SAGE, SURFACE_2, SURFACE_3, SURFACE_2_BORDER } from '../lib/theme.ts';

// ── Position taxonomy ──────────────────────────────────────────────────────

export const POSITION_DEFS = [
  // Top
  { key: 'mount_top',            label: 'Mount',          sub: 'top',     color: '#DA7422' },
  { key: 'side_control_top',     label: 'Side ctrl',      sub: 'top',     color: '#E8823A' },
  { key: 'back_top',             label: 'Back',           sub: 'taking',  color: '#C4915F' },
  { key: 'guard_passing',        label: 'Guard',          sub: 'passing', color: '#D4B86A' },
  { key: 'half_guard_top',       label: 'Half guard',     sub: 'top',     color: '#A8B97A' },
  // Bottom
  { key: 'mount_bottom',         label: 'Mount',          sub: 'bottom',  color: '#5E8A5C' },
  { key: 'side_control_bottom',  label: 'Side ctrl',      sub: 'bottom',  color: '#7BA177' },
  { key: 'back_bottom',          label: 'Back',           sub: 'defense', color: '#4A7A78' },
  { key: 'guard_playing',        label: 'Guard',          sub: 'playing', color: '#3A6A8A' },
  { key: 'half_guard_bottom',    label: 'Half guard',     sub: 'bottom',  color: '#4A5A8A' },
  // Neutral
  { key: 'standing',             label: 'Standing',       sub: '',        color: '#7A7A5A' },
  { key: 'scramble',             label: 'Scramble',       sub: '',        color: '#9A7A6A' },
] as const;

export type PositionKey = typeof POSITION_DEFS[number]['key'];

export const POSITION_COLOR: Record<string, string> = Object.fromEntries(
  POSITION_DEFS.map(p => [p.key, p.color]),
);

export interface DraftSegment {
  start_sec: number;
  end_sec: number | null; // null = currently open
  position_label: string;
}

interface Props {
  videoUrl: string;
  durationSecs: number | null;
  initialSegments?: DraftSegment[];
  onSave: (segments: Array<{ start_sec: number; end_sec: number; position_label: string }>) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function PositionTagger({ videoUrl, durationSecs, initialSegments = [], onSave, onCancel, saving = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [segments, setSegments] = useState<DraftSegment[]>(initialSegments);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSecs ?? 0);
  const [activePosition, setActivePosition] = useState<string | null>(
    initialSegments.find(s => s.end_sec === null)?.position_label ?? null,
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration || durationSecs || 0);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onMeta); };
  }, [durationSecs]);

  const tapPosition = useCallback((posKey: string) => {
    const v = videoRef.current;
    const now = v ? v.currentTime : 0;

    setSegments(prev => {
      // Close the currently-open segment (if any) at the current time.
      const closed = prev.map(s =>
        s.end_sec === null ? { ...s, end_sec: now } : s,
      ).filter(s => s.end_sec! > s.start_sec + 0.1); // drop sub-100ms taps

      // If tapping the same position that's already active, just close it (toggle off).
      if (posKey === activePosition) {
        setActivePosition(null);
        return closed;
      }

      // Open a new segment.
      setActivePosition(posKey);
      return [...closed, { start_sec: now, end_sec: null, position_label: posKey }];
    });
  }, [activePosition]);

  const handleSave = async () => {
    const now = videoRef.current?.currentTime ?? currentTime;
    // Close any open segment before saving.
    const final = segments
      .map(s => s.end_sec === null ? { ...s, end_sec: now } : s)
      .filter((s): s is { start_sec: number; end_sec: number; position_label: string } =>
        s.end_sec !== null && s.end_sec > s.start_sec + 0.1,
      );
    await onSave(final);
  };

  const dur = duration || 1;
  // Segments to render on the timeline (include the open segment up to currentTime).
  const timelineSegs = segments.map(s => ({
    ...s,
    end_sec: s.end_sec ?? currentTime,
  })).filter(s => s.end_sec > s.start_sec);

  const totalTagged = timelineSegs.reduce((acc, s) => acc + (s.end_sec - s.start_sec), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Video */}
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 280, objectFit: 'contain' }}
      />

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 20, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {timelineSegs.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(s.start_sec / dur) * 100}%`,
            width: `${Math.max(((s.end_sec - s.start_sec) / dur) * 100, 0.3)}%`,
            top: 0, bottom: 0,
            background: POSITION_COLOR[s.position_label] ?? COPPER,
            opacity: 0.85,
          }} />
        ))}
        {/* Playhead */}
        <div style={{
          position: 'absolute',
          left: `${(currentTime / dur) * 100}%`,
          top: 0, bottom: 0, width: 2,
          background: PALE_YELLOW,
          zIndex: 2,
        }} />
      </div>

      {/* Tagged coverage */}
      {totalTagged > 0 && (
        <p style={{ fontSize: 11, color: SAGE, margin: 0 }}>
          {Math.round(totalTagged)}s tagged · {timelineSegs.length} segment{timelineSegs.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Position buttons — 3 columns: top / bottom / neutral */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6 }}>
        {/* Top column header */}
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, paddingBottom: 2 }}>
          You on top
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, paddingBottom: 2 }}>
          You on bottom
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, paddingBottom: 2 }}>
          Neutral
        </div>

        {/* Top positions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {POSITION_DEFS.filter(p => p.sub === 'top' || p.sub === 'taking' || p.sub === 'passing').map(p => (
            <PositionButton key={p.key} posKey={p.key} label={p.label} sub={p.sub} color={p.color} active={activePosition === p.key} onTap={tapPosition} />
          ))}
        </div>

        {/* Bottom positions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {POSITION_DEFS.filter(p => p.sub === 'bottom' || p.sub === 'defense' || p.sub === 'playing').map(p => (
            <PositionButton key={p.key} posKey={p.key} label={p.label} sub={p.sub} color={p.color} active={activePosition === p.key} onTap={tapPosition} />
          ))}
        </div>

        {/* Neutral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {POSITION_DEFS.filter(p => p.sub === '').map(p => (
            <PositionButton key={p.key} posKey={p.key} label={p.label} sub={''} color={p.color} active={activePosition === p.key} onTap={tapPosition} />
          ))}
        </div>
      </div>

      {/* Clear + action row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => { setSegments([]); setActivePosition(null); }}
          style={{ flex: 1, padding: '9px 0', background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer' }}
        >
          Clear
        </button>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, borderRadius: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || segments.length === 0}
          style={{ flex: 2, padding: '9px 0', background: BRAND_ORANGE, border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: segments.length === 0 ? 'not-allowed' : 'pointer', opacity: segments.length === 0 ? 0.4 : 1 }}
        >
          {saving ? 'Saving…' : 'Save tags'}
        </button>
      </div>
    </div>
  );
}

// ── Position button ────────────────────────────────────────────────────────

function PositionButton({ posKey, label, sub, color, active, onTap }: {
  posKey: string; label: string; sub: string; color: string; active: boolean; onTap: (k: string) => void;
}) {
  return (
    <button
      onClick={() => onTap(posKey)}
      style={{
        padding: '6px 8px',
        borderRadius: 7,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.10)'}`,
        background: active ? `${color}22` : SURFACE_3,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.12s, background 0.12s',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: active ? color : PALE_YELLOW, lineHeight: 1.1 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{sub}</div>}
    </button>
  );
}
