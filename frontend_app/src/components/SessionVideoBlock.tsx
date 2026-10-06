// SessionVideoBlock — video capture and position tagging for a training session.
//
// Three states:
//   empty   → file picker + "Attach footage" CTA
//   loading → upload progress / transcode spinner
//   ready   → video player + position stats + "Tag positions" button
//
// Tagging opens a full-screen portal overlay (z-index 60) above the session
// modal — PositionTagger is not rendered inline.

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api.ts';
import { validateVideoFile, probeVideo, extractThumbnail, formatDurationMMSS } from '../lib/videoUtils.ts';
import { uploadToR2 } from '../lib/videoUploader.ts';
import {
  BRAND_ORANGE, COPPER, PALE_YELLOW, SAGE, SURFACE_2, SURFACE_3,
  SURFACE_2_BORDER, STATUS_ERROR, CARD_BG, PAGE_BG,
} from '../lib/theme.ts';
import type { SessionVideo, PositionSegment } from '../types/api.ts';
import PositionTagger, { POSITION_COLOR, POSITION_DEFS } from './PositionTagger.tsx';
import type { DraftSegment } from './PositionTagger.tsx';

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

      await uploadToR2(mint.uploadUrl, file, file.type, (pct) => setUploadProgress(Math.round(pct * 100)));

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
      setTaggingVideoId(null);
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
            onTagClick={() => setTaggingVideoId(v.id)}
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
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%', padding: '14px 0', marginTop: videos.length > 0 ? 10 : 0,
              background: SURFACE_2, border: `1px dashed ${SURFACE_2_BORDER}`, borderRadius: 10,
              color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer',
            }}
          >
            + Attach footage
          </button>
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

      {/* Full-screen tagging overlay — mounts above the session modal (z-index 60) */}
      {taggingVideoId && createPortal(
        <div
          data-no-page-swipe=""
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: PAGE_BG,
            display: 'flex', flexDirection: 'column',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Session strip */}
          <div style={{
            height: 52, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            padding: '0 16px', gap: 12,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button
              onClick={() => setTaggingVideoId(null)}
              className="touch-manipulation"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}
            >
              ‹ Done
            </button>
            <span style={{
              flex: 1, textAlign: 'center',
              fontSize: 12, color: PALE_YELLOW, letterSpacing: '0.04em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {sessionLabel}
            </span>
            <span style={{ width: 52 }} aria-hidden />
          </div>

          {/* Tagger body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
            {taggingPlaybackUrl ? (
              <PositionTagger
                videoUrl={taggingPlaybackUrl}
                durationSecs={taggingDur}
                initialSegments={(segments[taggingVideoId] ?? []) as DraftSegment[]}
                onSave={(segs) => saveSegments(taggingVideoId, segs)}
                onCancel={() => setTaggingVideoId(null)}
                saving={savingSegments}
              />
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
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
  const dur = video.video_duration_seconds ?? 0;

  return (
    <div style={{ background: SURFACE_2, border: `1px solid ${SURFACE_2_BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>

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
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatDurationMMSS(dur)}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onTagClick} style={{ fontSize: 12, color: BRAND_ORANGE, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {segments.length > 0 ? 'Re-tag' : 'Tag positions'}
              </button>
              <button onClick={onDelete} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>

          {/* Thumbnail or video preview */}
          {video.video_thumbnail ? (
            <img
              src={video.video_thumbnail}
              alt="Session footage thumbnail"
              style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 180 }}
            />
          ) : null}

          {/* Position breakdown */}
          {segments.length > 0 && <PositionBreakdown segments={segments} totalDur={dur} />}
        </>
      )}

      {/* Tagging mode */}
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
      <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', display: 'flex', marginBottom: 10 }}>
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
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
