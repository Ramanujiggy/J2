// VideoPlayer — inline 16/9 video surface for a Move Library clip.
//
// Used inside VideoBlock on TechniquePage. Replaces the older
// VideoPlayerModal which portalled to <body> and dimmed the page.
//
// Source resolution (Move Library v2, mig 028):
//   1. OPFS cache hit via loadVideo(tag.id) — instant, offline-capable.
//   2. Miss → fetch a 5-min signed GET URL from /api/user-tags/:id/video/url,
//      stream the bytes into a Blob (so iOS PWA never has to play a
//      cross-origin <video src>), play from a same-origin blob URL, and
//      backfill the OPFS cache so the next playback is instant.
//
// Player config: controls + autoPlay + loop + muted + playsInline. Tap-once
// starts a muted loop; the user can unmute via the native controls. Loop +
// muted-autoplay is right for short technique reference clips where the
// user wants to watch the move repeat a few times without tapping again.

import { useState, useEffect } from 'react';
import { loadVideo, saveVideo, deleteVideosForTag } from '../lib/videoStore.ts';
import { api } from '../lib/api.ts';
import type { UserTag } from '../types/api.ts';

interface Props {
  tag: UserTag;
  onClose: () => void;
  /**
   * When true, the player wrapper is repositioned to a fixed mini-player at
   * bottom-right of the viewport. The `<video>` element itself doesn't
   * remount — only the wrapper's CSS changes — so playback continues
   * seamlessly when the user scrolls past the inline slot and back.
   */
  stuck?: boolean;
}

export default function VideoPlayer({ tag, onClose, stuck = false }: Props) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Tracked separately so we can pass an explicit type to <source>. iOS PWA
  // standalone mode takes a different code path for <video><source type=...>
  // than for <video src=...>, and sometimes only the former plays a blob URL.
  const [sourceType, setSourceType] = useState<string>('video/mp4');
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let urlToRevoke: string | null = null;
    const abortController = new AbortController();

    // Cache key includes the server's authoritative byte size as a version
    // discriminator. A re-upload from any device produces a different
    // encoded size and therefore a different cache key — so the next
    // playback on every device misses the stale cache and refetches.
    const cacheKey = tag.video_byte_size != null
      ? `${tag.id}@${tag.video_byte_size}`
      : tag.id;

    (async () => {
      try {
        const blob = await loadVideo(cacheKey);
        if (cancelled) return;
        if (blob) {
          const url = URL.createObjectURL(blob);
          urlToRevoke = url;
          setSourceType(blob.type || 'video/mp4');
          setVideoUrl(url);
          setLoading(false);
          return;
        }
      } catch {
        // Continue to cloud fallback
      }

      try {
        const res = await api.get<{
          status: 'ready' | 'processing' | 'failed' | null;
          url?: string;
          message?: string | null;
        }>(`/api/user-tags/${tag.id}/video/url`);

        if (cancelled) return;

        if (res.status === 'ready' && res.url) {
          const fetched = await fetch(res.url, { signal: abortController.signal });
          if (!fetched.ok) {
            throw new Error(`R2 fetch failed: HTTP ${fetched.status}`);
          }

          const total = Number(fetched.headers.get('Content-Length') || 0);
          const reader = fetched.body?.getReader();
          if (!reader) throw new Error('R2 fetch returned no readable body.');

          const chunks: Uint8Array[] = [];
          let received = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            if (!cancelled && total > 0) {
              setDownloadPercent(Math.round((received / total) * 100));
            }
          }
          if (cancelled) return;

          const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          urlToRevoke = url;
          setSourceType('video/mp4');
          setVideoUrl(url);
          setLoading(false);

          // Best-effort cache backfill for next time. Cloud is canonical;
          // don't block playback on this. Sweep any stale entries for the
          // same tag (older sizes, legacy unversioned key) before writing
          // the fresh one so OPFS doesn't accumulate orphans.
          (async () => {
            try {
              await deleteVideosForTag(tag.id);
              await saveVideo(cacheKey, blob);
            } catch (err) {
              console.warn(`OPFS cache backfill failed for tag ${tag.id}:`, err);
            }
          })();
        } else {
          setMissing(true);
          setLoading(false);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          setMissing(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [tag.id]);

  const wrapperStyle: React.CSSProperties = stuck
    ? {
        position: 'fixed',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        right: 'max(16px, env(safe-area-inset-right))',
        width: 'min(240px, 38vw)',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        boxShadow: '0 10px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(196,145,95,0.18)',
      }
    : {
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      };

  return (
    <div style={wrapperStyle}>
      {loading && (
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>
          {downloadPercent != null ? `Downloading ${downloadPercent}%…` : 'Loading…'}
        </p>
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
          key={videoUrl}
          controls
          autoPlay
          loop
          muted
          playsInline
          onError={e => {
            const v = e.currentTarget;
            const code = v.error?.code ?? null;
            const message = v.error?.message ?? null;
            const codeLabel =
              code === 1 ? 'ABORTED' :
              code === 2 ? 'NETWORK' :
              code === 3 ? 'DECODE' :
              code === 4 ? 'SRC_NOT_SUPPORTED' :
              `unknown (${code})`;
            setPlayerError(`MediaError ${code} (${codeLabel})${message ? ` — ${message}` : ''}`);
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        >
          <source src={videoUrl} type={sourceType} />
        </video>
      )}

      {/* Inline error surface — defensive; doesn't fire on the happy path */}
      {playerError && (
        <div
          style={{
            position: 'absolute',
            left: 8, right: 8, bottom: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(218,90,70,0.85)',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {playerError}
        </div>
      )}

      {/* Close button — top-right overlay. Same affordance pattern as the
          old modal's × but sized for an inline tile. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        style={{
          position: 'absolute',
          top: 6, right: 6,
          width: 28, height: 28,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 16,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}
