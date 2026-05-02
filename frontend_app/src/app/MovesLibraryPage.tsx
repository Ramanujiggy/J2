// MovesLibraryPage — personal video library of techniques.
//
// Shows the user's tag library as a grid of cards. Each tag can have an
// optional video clip attached. Tap a card with video → play. Tap "Add" on
// a card without video → file picker (camera on mobile via `capture`).
//
// Tier 1 (free, default): video files live in browser storage. Server stores
// only metadata + thumbnail. Cross-device the user sees thumbnails but the
// playable file may be missing (handled gracefully by VideoPlayerModal).

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContent from '../components/PageContent.tsx';
import VideoPlayerModal from '../components/VideoPlayerModal.tsx';
import LibraryEmptyHero from '../components/empty/LibraryEmptyHero.tsx';
import { useUserTags } from '../hooks/useUserTags.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, SURFACE_2, SURFACE_3 } from '../lib/theme.ts';
import { formatDurationMMSS } from '../lib/videoUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import { ChevronLeft, Video } from 'lucide-react';
import type { UserTag, Pillar } from '../types/api.ts';

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};
const PILLAR_ORDER: Pillar[] = ['standup', 'passing', 'guard', 'pins', 'submissions'];

export default function MovesLibraryPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { tags, loading, error, attachVideo, detachVideo } = useUserTags();

  const [playing, setPlaying] = useState<UserTag | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'with-video' | 'without-video'>('all');

  const filtered = useMemo(() => {
    let list = tags;
    if (filter === 'with-video') list = list.filter(t => t.has_video);
    if (filter === 'without-video') list = list.filter(t => !t.has_video);
    // Sort: with-video first, then alphabetical
    return [...list].sort((a, b) => {
      const av = a.has_video ? 1 : 0;
      const bv = b.has_video ? 1 : 0;
      if (av !== bv) return bv - av;
      return a.name.localeCompare(b.name);
    });
  }, [tags, filter]);

  const counts = useMemo(() => ({
    total: tags.length,
    withVideo: tags.filter(t => t.has_video).length,
  }), [tags]);

  const handleFilePick = async (tag: UserTag, file: File) => {
    setUploadingId(tag.id);
    await attachVideo(tag.id, file);
    setUploadingId(null);
  };

  const handleRemove = async (tag: UserTag) => {
    if (!confirm(`Remove video from "${tag.name}"?`)) return;
    await detachVideo(tag.id);
  };

  return (
    <PageContent ready={!loading} loadingMessages={['Loading the library...']}>
      <div className={`space-y-5 ${isDesktop ? 'j2-page-container' : 'mx-auto max-w-5xl px-4 sm:px-6'}`} style={isDesktop ? { paddingTop: 20, paddingBottom: 20 } : { paddingTop: 24, paddingBottom: 24 }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              onClick={() => navigate('/profile')}
              className="text-xs flex items-center gap-1 mb-2 transition-colors touch-manipulation"
              style={{ color: 'rgba(255,255,255,0.40)' }}
            >
              <ChevronLeft size={13} />
              Profile
            </button>
            <h2 className="text-2xl font-display font-bold tracking-tight" style={{ color: PALE_YELLOW, textShadow: GLOW_SOFT }}>
              Move Library
            </h2>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {counts.withVideo} of {counts.total} tags have video
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {([
            ['all', `All (${counts.total})`],
            ['with-video', `With video (${counts.withVideo})`],
            ['without-video', `Needs video (${counts.total - counts.withVideo})`],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => { vibrate(6); setFilter(val); }}
              className="text-xs px-3 py-1.5 rounded-full transition-colors touch-manipulation"
              style={{
                backgroundColor: filter === val ? COPPER : SURFACE_2,
                color: filter === val ? 'white' : 'rgba(255,255,255,0.50)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Empty state — editorial chapter title pattern */}
        {!loading && tags.length === 0 && <LibraryEmptyHero />}

        {/* Grid */}
        {filtered.length > 0 && (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: isDesktop
                ? 'repeat(auto-fill, minmax(220px, 1fr))'
                : 'repeat(auto-fill, minmax(150px, 1fr))',
            }}
          >
            {filtered.map(tag => (
              <MoveCard
                key={tag.id}
                tag={tag}
                uploading={uploadingId === tag.id}
                onPlay={() => { vibrate(8); setPlaying(tag); }}
                onPickFile={file => void handleFilePick(tag, file)}
                onRemove={() => void handleRemove(tag)}
              />
            ))}
          </div>
        )}

        {/* By-pillar legend (decorative, helps users scan) */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.30)' }}>
            {PILLAR_ORDER.map(p => (
              <span key={p}>{PILLAR_LABELS[p]}: {tags.filter(t => t.parent_pillar === p).length}</span>
            ))}
          </div>
        )}
      </div>

      {playing && (
        <VideoPlayerModal tag={playing} onClose={() => setPlaying(null)} />
      )}
    </PageContent>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

interface MoveCardProps {
  tag: UserTag;
  uploading: boolean;
  onPlay: () => void;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

function MoveCard({ tag, uploading, onPlay, onPickFile, onRemove }: MoveCardProps) {
  const hasVideo = !!tag.has_video;
  const inputId = `video-${tag.id}`;

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col"
      style={{
        backgroundColor: SURFACE_2,
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Thumbnail / placeholder */}
      <button
        type="button"
        onClick={hasVideo ? onPlay : undefined}
        disabled={!hasVideo || uploading}
        className="block w-full aspect-video relative touch-manipulation j2-press"
        style={{
          backgroundColor: '#000',
          cursor: hasVideo ? 'pointer' : 'default',
        }}
      >
        {tag.video_thumbnail ? (
          <img
            src={tag.video_thumbnail}
            alt={`${tag.name} thumbnail`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: SURFACE_3 }}>
            <Video size={28} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.20)' }} />
          </div>
        )}
        {hasVideo && (
          <>
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)' }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 44, height: 44,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  border: '1.5px solid rgba(255,255,255,0.85)',
                }}
              >
                <span style={{ color: 'white', fontSize: 16, marginLeft: 3 }}>▶</span>
              </div>
            </div>
            {tag.video_duration_seconds != null && (
              <span
                className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: 'rgba(0,0,0,0.65)', color: 'white' }}
              >
                {formatDurationMMSS(tag.video_duration_seconds)}
              </span>
            )}
          </>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <p className="text-xs" style={{ color: COPPER }}>Saving…</p>
          </div>
        )}
      </button>

      {/* Body */}
      <div className="px-3 py-2.5 flex-1 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {tag.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: COPPER }}>
            {PILLAR_LABELS[tag.parent_pillar]}
          </span>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-1">
          <input
            id={inputId}
            type="file"
            accept="video/*"
            // `capture` prompts the device camera on mobile (intent-based on Android, native sheet on iOS)
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = ''; // allow picking the same file again later
            }}
          />
          <label
            htmlFor={inputId}
            className="text-[11px] font-medium px-2.5 py-1 rounded-md cursor-pointer touch-manipulation transition-colors"
            style={{
              backgroundColor: hasVideo ? SURFACE_3 : 'rgba(196,145,95,0.20)',
              color: hasVideo ? 'rgba(255,255,255,0.55)' : COPPER,
            }}
          >
            {hasVideo ? 'Replace' : '+ Record / Upload'}
          </label>
          {hasVideo && (
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] transition-colors touch-manipulation"
              style={{ color: 'rgba(218,90,70,0.65)' }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
