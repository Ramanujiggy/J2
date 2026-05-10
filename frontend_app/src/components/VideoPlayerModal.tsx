// VideoPlayerModal — plays a Move Library clip with a two-stage source resolution.
//
// Lookup order (Move Library v2, mig 028):
//   1. Try local OPFS cache via videoStore.loadVideo(tag.id). Fast path —
//      no network roundtrip when the clip has already been streamed once
//      on this device (the cloud upload flow writes to OPFS as a side
//      effect; the playback fallback below also caches on first stream).
//   2. Miss → fetch a 5-min signed GET URL from the server and stream
//      directly from R2 by setting <video src={signedUrl}>. Browser
//      handles range requests + adaptive buffering natively.
//
// "video unavailable" only fires now on a genuine error path — the encode
// failed, the network is down, or the user is signed out. The pre-mig-028
// case ("recorded on another device") no longer applies because cloud is
// the canonical source.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CARD_BG, COPPER, PALE_YELLOW, GLOW_SOFT, SURFACE_2 } from '../lib/theme.ts';
import { loadVideo } from '../lib/videoStore.ts';
import { formatDurationMMSS } from '../lib/videoUtils.ts';
import { api } from '../lib/api.ts';
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
      // Step 1: try local OPFS cache. Fastest path — works offline and
      // skips the signing roundtrip when the user has already streamed
      // (or just uploaded) this clip on this device.
      try {
        const blob = await loadVideo(tag.id);
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          urlToRevoke = url;
          setVideoUrl(url);
          setLoading(false);
          return;
        }
      } catch {
        // Continue to cloud fallback
      }

      // Step 2: cloud fallback. Server returns a 5-min signed GET URL
      // (or a status-only response when the encode is still running).
      try {
        const res = await api.get<{
          status: 'ready' | 'processing' | 'failed' | null;
          url?: string;
          message?: string | null;
        }>(`/api/user-tags/${tag.id}/video/url`);

        if (cancelled) return;

        if (res.status === 'ready' && res.url) {
          // Use the signed URL directly as the <video src>. Browser
          // streams via range requests; no need to download to a Blob first.
          // Don't track this URL in urlToRevoke — only object-URLs need
          // revoking; signed URLs are just regular HTTP and the browser
          // garbage-collects them.
          setVideoUrl(res.url);
          setLoading(false);
        } else {
          // status='processing' / 'failed' / null — show the unavailable
          // surface with the appropriate message. The Pokedex polling
          // already handles 'processing' transitions; this modal
          // shouldn't usually open in those states, but defensive.
          setMissing(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setMissing(true);
          setLoading(false);
        }
      }
    })();

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
                {tag.video_status === 'processing' ? 'Still encoding…' : 'Video unavailable.'}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                {tag.video_status === 'processing'
                  ? 'Hang tight — the encode usually finishes in under a minute.'
                  : tag.video_status === 'failed'
                    ? "The encode failed. Open the technique page to retry."
                    : 'Check your connection and try again.'}
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
