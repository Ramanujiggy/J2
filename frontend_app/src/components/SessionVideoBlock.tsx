// SessionVideoBlock — video capture and position tagging for a training session.
//
// Three states:
//   empty   → file picker + "Attach footage" CTA
//   loading → upload progress / transcode spinner
//   ready   → video player + position stats + "Tag positions" button
//
// Tagging opens a portal overlay (z-index 60) above the session modal — the
// §4 modal box (large 42rem variant), not rendered inline.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.ts';
import { validateVideoFile, probeVideo, extractThumbnail, formatDurationMMSS } from '../lib/videoUtils.ts';
import { uploadToR2 } from '../lib/videoUploader.ts';
import {
  BRAND_ORANGE, COPPER, PALE_YELLOW, SAGE, SURFACE_2,
  SURFACE_2_BORDER, STATUS_ERROR, CARD_BG, COPPER_BORDER,
  TEXT_TERTIARY, TEXT_HINT,
} from '../lib/theme.ts';
import type { SessionVideo, PositionSegment } from '../types/api.ts';
import PositionTagger, { POSITION_COLOR, POSITION_DEFS } from './PositionTagger.tsx';
import type { DraftSegment } from './PositionTagger.tsx';
import FilmingGuide, { hasSeenFilmingGuide, markFilmingGuideSeen } from './FilmingGuide.tsx';

interface Props {
  sessionId: string;
  sessionLabel?: string;
}

export default function SessionVideoBlock({ sessionId, sessionLabel }: Props) {
  const [videos, setVideos] = useState<SessionVideo[]>([]);
  const [segments, setSegments] = useState<Record<string, PositionSegment[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [playbackUrls, setPlaybackUrls] = useState<Record<string, string>>({});
  const [taggingVideoId, setTaggingVideoId] = useState<string | null>(null);
  const [savingSegments, setSavingSegments] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const openTagger = (videoId: string) => setTaggingVideoId(videoId);
  const closeTagger = () => setTaggingVideoId(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadVideos = useCallback(async () => {
    try {
      const data = await api.get<{ videos: SessionVideo[] }>(`/api/sessions/${sessionId}/videos`);
      setVideos(data.videos);
    } catch { /* silent */ }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { loadVideos(); return () => { if (pollRef.current) clearTimeout(pollRef.current); }; }, [loadVideos]);

  // Poll until all processing videos are ready.
  useEffect(() => {
    const processing = videos.filter(v => v.video_status === 'processing');
    if (processing.length === 0) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(loadVideos, 4000);
  }, [videos, loadVideos]);

  const loadPlaybackUrl = useCallback(async (videoId: string) => {
    try {
      const data = await api.get<{ status: string; url?: string }>(`/api/sessions/${sessionId}/videos/${videoId}/url`);
      if (data.status === 'ready' && data.url) {
        setPlaybackUrls(prev => ({ ...prev, [videoId]: data.url! }));
      }
    } catch { /* silent */ }
  }, [sessionId]);

  const loadSegments = useCallback(async (videoId: string) => {
    try {
      const data = await api.get<{ segments: PositionSegment[] }>(`/api/sessions/${sessionId}/videos/${videoId}/segments`);
      setSegments(prev => ({ ...prev, [videoId]: data.segments }));
    } catch { /* silent */ }
  }, [sessionId]);

  // Load playback URLs + segments for ready videos.
  useEffect(() => {
    for (const v of videos) {
      if (v.video_status === 'ready' && !playbackUrls[v.id]) loadPlaybackUrl(v.id);
      if (v.video_status === 'ready' && !segments[v.id]) loadSegments(v.id);
    }
  }, [videos, playbackUrls, segments, loadPlaybackUrl, loadSegments]);

  // First attach shows the filming guide; after that the picker opens directly.
  const attachFootage = () => {
    if (hasSeenFilmingGuide()) { fileInputRef.current?.click(); return; }
    setGuideOpen(true);
  };
  const closeGuide = () => { markFilmingGuideSeen(); setGuideOpen(false); };
  const chooseFromGuide = () => { closeGuide(); fileInputRef.current?.click(); };

  const handleFile = async (file: File) => {
    setUploadError(null);
    const validation = validateVideoFile(file);
    if (!validation.valid) { setUploadError(validation.reason ?? 'Invalid file'); return; }

    setUploadProgress(0);
    try {
      const probe = await probeVideo(file);
      const thumb = await extractThumbnail(file).catch(() => null);
      const ext = file.name.split('.').pop() ?? 'mp4';

      const mint = await api.post<{ videoId: string; uploadUrl: string; storageKey: string }>(
        `/api/sessions/${sessionId}/videos/upload-url`,
        { content_type: file.type, ext },
      );

      await uploadToR2(mint.uploadUrl, file, file.type, (p) => setUploadProgress(p.percent));

      await api.post(`/api/sessions/${sessionId}/videos/${mint.videoId}/upload-complete`, {
        raw_storage_key: mint.storageKey,
        byte_size: file.size,
        video_thumbnail: thumb,
        video_duration_seconds: Math.round(probe.durationSeconds),
      });

      setUploadProgress(null);
      loadVideos();
    } catch (err) {
      setUploadProgress(null);
      setUploadError(err instanceof Error ? err.message : 'Upload failed — please try again.');
    }
  };

  const deleteVideo = async (videoId: string) => {
    try {
      await api.delete(`/api/sessions/${sessionId}/videos/${videoId}`);
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setPlaybackUrls(prev => { const n = { ...prev }; delete n[videoId]; return n; });
      setSegments(prev => { const n = { ...prev }; delete n[videoId]; return n; });
    } catch { /* silent */ }
  };

  const saveSegments = async (videoId: string, segs: Array<{ start_sec: number; end_sec: number; position_label: string }>) => {
    setSavingSegments(true);
    try {
      const data = await api.put<{ segments: PositionSegment[] }>(
        `/api/sessions/${sessionId}/videos/${videoId}/segments`,
        { segments: segs },
      );
      setSegments(prev => ({ ...prev, [videoId]: data.segments }));
      closeTagger();
    } catch { /* silent */ }
    setSavingSegments(false);
  };

  if (loading) return null;

  // Resolve the active tagger video for the portal overlay.
  const taggingVideo = taggingVideoId ? videos.find(v => v.id === taggingVideoId) : null;
  const taggingPlaybackUrl = taggingVideoId ? (playbackUrls[taggingVideoId] ?? null) : null;
  const taggingDur = taggingVideo?.video_duration_seconds ?? 0;

  return (
    <>
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, marginBottom: 12 }}>
          Footage
        </div>

        {/* Existing videos — tagging mode is handled by the portal overlay */}
        {videos.map(v => (
          <VideoCard
            key={v.id}
            video={v}
            playbackUrl={playbackUrls[v.id] ?? null}
            segments={segments[v.id] ?? []}
            isTagging={false}
            savingSegments={false}
            onTagClick={() => openTagger(v.id)}
            onCancelTag={() => setTaggingVideoId(null)}
            onSaveSegments={(segs) => saveSegments(v.id, segs)}
            onDelete={() => deleteVideo(v.id)}
            onRetry={async () => { await api.post(`/api/sessions/${sessionId}/videos/${v.id}/retry`, {}); loadVideos(); }}
          />
        ))}

        {/* Upload zone */}
        {uploadProgress !== null ? (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: PALE_YELLOW, marginBottom: 6 }}>Uploading… {uploadProgress}%</div>
            <div style={{ height: 4, background: SURFACE_2, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: BRAND_ORANGE, width: `${uploadProgress}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={attachFootage}
              className="touch-manipulation"
              style={{
                width: '100%', padding: '14px 0', minHeight: 44, marginTop: videos.length > 0 ? 10 : 0,
                background: SURFACE_2, border: `1px dashed ${SURFACE_2_BORDER}`, borderRadius: 10,
                color: TEXT_TERTIARY, fontSize: 13, cursor: 'pointer',
              }}
            >
              + Attach footage
            </button>
            <button
              onClick={() => setGuideOpen(true)}
              className="touch-manipulation"
              style={{
                display: 'block', margin: '2px auto 0', minHeight: 44, padding: '0 12px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: COPPER, fontSize: 12, fontWeight: 600,
              }}
            >
              How to film a roll
            </button>
          </>
        )}

        {uploadError && <p style={{ fontSize: 12, color: STATUS_ERROR, marginTop: 6 }}>{uploadError}</p>}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      </div>

      {guideOpen && (
        <FilmingGuide actionLabel="Choose footage" onAction={chooseFromGuide} onClose={closeGuide} />
      )}

      {/* Tagging overlay — §4 modal box (large 42rem variant), portal above the session modal */}
      {taggingVideoId && createPortal(
        <div
          role="presentation"
          onClick={e => { if (e.target === e.currentTarget) closeTagger(); }}
          className="animate-j2-backdrop-in"
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(13,26,20,0.85)',
            backdropFilter: 'blur(12px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            overflowY: 'auto',
            paddingLeft: '1rem', paddingRight: '1rem',
            paddingTop: 'max(1rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tag positions"
            data-no-page-swipe=""
            className="animate-j2-modal-in"
            style={{
              width: '100%', maxWidth: '42rem',
              background: CARD_BG,
              border: `1px solid ${COPPER_BORDER}`,
              borderRadius: 16,
              padding: 24,
              maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)',
              overflowY: 'auto',
            }}
          >
            {/* Header — session eyebrow + Done */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{
                flex: 1,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: COPPER,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {sessionLabel ?? 'Tag positions'}
              </span>
              <button
                onClick={closeTagger}
                className="touch-manipulation"
                style={{ flexShrink: 0, fontSize: 13, color: TEXT_TERTIARY, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 8px', minHeight: 44 }}
              >
                Done
              </button>
            </div>

            {/* Tagger body */}
            {taggingPlaybackUrl ? (
              <PositionTagger
                videoUrl={taggingPlaybackUrl}
                durationSecs={taggingDur}
                initialSegments={(segments[taggingVideoId] ?? []) as DraftSegment[]}
                onSave={(segs) => saveSegments(taggingVideoId, segs)}
                onCancel={closeTagger}
                saving={savingSegments}
              />
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: TEXT_HINT }}>
                Loading video…
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── VideoCard ──────────────────────────────────────────────────────────────

function VideoCard({
  video, playbackUrl, segments, isTagging, savingSegments,
  onTagClick, onCancelTag, onSaveSegments, onDelete, onRetry,
}: {
  video: SessionVideo;
  playbackUrl: string | null;
  segments: PositionSegment[];
  isTagging: boolean;
  savingSegments: boolean;
  onTagClick: () => void;
  onCancelTag: () => void;
  onSaveSegments: (segs: Array<{ start_sec: number; end_sec: number; position_label: string }>) => Promise<void>;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const isDesktop = useIsDesktop();
  const dur = video.video_duration_seconds ?? 0;
  const tappable = !isDesktop && video.video_status === 'ready';

  return (
    <div
      onClick={tappable ? onTagClick : undefined}
      style={{
        background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10,
        cursor: tappable ? 'pointer' : undefined,
      }}
    >

      {/* Status: processing */}
      {video.video_status === 'processing' && (
        <div style={{ fontSize: 12, color: PALE_YELLOW, textAlign: 'center', padding: '8px 0' }}>
          Processing video…
        </div>
      )}

      {/* Status: failed */}
      {video.video_status === 'failed' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: STATUS_ERROR }}>Transcode failed</span>
          <button onClick={onRetry} style={{ fontSize: 12, color: BRAND_ORANGE, background: 'none', border: 'none', cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* Status: ready */}
      {video.video_status === 'ready' && !isTagging && (
        <>
          {/* Header row: duration + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: TEXT_TERTIARY }}>{formatDurationMMSS(dur)}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {isDesktop && (
                <button onClick={onTagClick} style={{ fontSize: 12, color: BRAND_ORANGE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  {segments.length > 0 ? 'Re-tag' : 'Tag positions'}
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                style={{ fontSize: 12, color: TEXT_HINT, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          </div>

          {/* Thumbnail or video preview */}
          {video.video_thumbnail ? (
            <img
              src={video.video_thumbnail}
              alt="Session footage thumbnail"
              style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 180 }}
            />
          ) : null}

          {/* Position breakdown */}
          {segments.length > 0 && <PositionBreakdown segments={segments} totalDur={dur} />}
        </>
      )}

      {/* Tagging mode (legacy inline path — superseded by portal overlay) */}
      {video.video_status === 'ready' && isTagging && playbackUrl && (
        <PositionTagger
          videoUrl={playbackUrl}
          durationSecs={dur}
          onSave={onSaveSegments}
          onCancel={onCancelTag}
          saving={savingSegments}
        />
      )}
    </div>
  );
}

// ── Position breakdown ─────────────────────────────────────────────────────

function PositionBreakdown({ segments, totalDur }: { segments: PositionSegment[]; totalDur: number }) {
  const totals: Record<string, number> = {};
  for (const s of segments) {
    totals[s.position_label] = (totals[s.position_label] ?? 0) + (s.end_sec - s.start_sec);
  }

  const sorted = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const taggedSecs = Object.values(totals).reduce((a, b) => a + b, 0);
  const base = Math.max(taggedSecs, totalDur, 1);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: COPPER, marginBottom: 8 }}>
        Position breakdown
      </div>

      {/* Stacked bar */}
      <div style={{ height: 8, borderRadius: 2, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', display: 'flex', marginBottom: 10 }}>
        {sorted.map(([label, secs]) => (
          <div key={label} style={{
            height: '100%',
            width: `${(secs / base) * 100}%`,
            background: POSITION_COLOR[label] ?? COPPER,
          }} />
        ))}
      </div>

      {sorted.map(([label, secs]) => {
        const def = POSITION_DEFS.find(p => p.key === label);
        const pct = Math.round((secs / base) * 100);
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, flexShrink: 0, background: POSITION_COLOR[label] ?? COPPER }} />
            <span style={{ flex: 1, fontSize: 12, color: PALE_YELLOW }}>
              {def ? `${def.label}${def.sub ? ` (${def.sub})` : ''}` : label}
            </span>
            <span style={{ fontSize: 11, color: SAGE }}>{Math.round(secs)}s</span>
            <span style={{ fontSize: 11, color: TEXT_TERTIARY, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
