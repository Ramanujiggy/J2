// VideoPlayerModal — plays a Move Library clip from local storage.
//
// Loads the blob from videoStore on mount, creates an object URL, hands it to
// <video>, and releases the URL on unmount to prevent leaks.
//
// Falls back to a "video missing" message when the local clip is gone (e.g.
// browser storage was cleared) — the server-side thumbnail still appears in
// the library so the user knows what they used to have.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CARD_BG, COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_2 } from '../lib/theme.ts';
import { loadVideo } from '../lib/videoStore.ts';
import { formatDurationMMSS } from '../lib/videoUtils.ts';
import type { UserTag } from '../types/api.ts';

const PILLAR_LABELS: Record<string, string> = {
  standup: 'Stand-up',
  passing: 'Guard Passing',
  pins: 'Dynamic Pins',
  submissions: 'Submissions',
  guard: 'Guard',
};

interface Props {
  tag: UserTag;
  onClose: () => void;
}

export default function VideoPlayerModal({ tag, onClose }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let urlToRevoke: string | null = null;

    (async () => {
      const blob = await loadVideo(tag.id);
      if (cancelled) return;
      if (!blob) {
        setMissing(true);
        setLoading(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      urlToRevoke = url;
      setVideoUrl(url);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setMissing(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [tag.id]);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 70,
        backgroundColor: 'rgba(13,26,20,0.92)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-j2-modal-in"
        style={{
          width: '100%', maxWidth: 720,
          backgroundColor: CARD_BG,
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '1rem',
          padding: '1.25rem',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-display font-bold truncate" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
              {tag.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: COPPER }}>
                {PILLAR_LABELS[tag.parent_pillar] ?? tag.parent_pillar}
              </span>
              {tag.video_duration_seconds != null && (
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
                  · {formatDurationMMSS(tag.video_duration_seconds)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors text-xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Player */}
        <div
          className="rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            backgroundColor: '#000',
            border: '1px solid rgba(255,255,255,0.05)',
            aspectRatio: '16 / 9',
          }}
        >
          {loading && (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>Loading…</p>
          )}
          {!loading && missing && (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              {tag.video_thumbnail && (
                <img
                  src={tag.video_thumbnail}
                  alt=""
                  style={{ width: '100%', maxWidth: 240, opacity: 0.5, borderRadius: 8 }}
                />
              )}
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Video unavailable on this device.
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                The clip was recorded on another device or browser storage was cleared.
              </p>
            </div>
          )}
          {!loading && videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* Notes */}
        {tag.video_notes && (
          <div
            className="mt-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.30)' }}>
              Notes
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)', whiteSpace: 'pre-wrap' }}>
              {tag.video_notes}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
