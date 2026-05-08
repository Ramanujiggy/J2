// MovesLibraryPage — personal Technique Library (route stays `/library` for
// URL stability; the page header reads "Technique Library" per migration 027).
//
// Shows the user's tag library as a grid of cards. Each tag can carry:
//   • An optional video clip (Move Library — Tier 1, mig 010)
//   • An affinity badge (★ go-to / ◐ learning / ◌ shelved — mig 027)
//   • A cumulative resonance journal (mig 027 — visible on the Pokedex)
//
// Tap anywhere on a card → navigate to `/techniques/:id` (the Pokedex).
// A small inset ▶ button on the thumbnail plays the video in place.
//
// Filter chips: All / ★ Go-to / ◐ Learning / ◌ Shelved / Has video.
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
import type { UserTag, Pillar, Affinity } from '../types/api.ts';

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Subs',
  guard: 'Guard',
};
const PILLAR_ORDER: Pillar[] = ['standup', 'passing', 'guard', 'pins', 'submissions'];

type LibraryFilter = 'all' | 'go_to' | 'learning' | 'shelved' | 'with-video';

export default function MovesLibraryPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { tags, loading, error, attachVideo, detachVideo } = useUserTags();

  const [playing, setPlaying] = useState<UserTag | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const filtered = useMemo(() => {
    let list = tags;
    if (filter === 'with-video')   list = list.filter(t => t.has_video);
    else if (filter === 'go_to')    list = list.filter(t => t.affinity === 'go_to');
    else if (filter === 'learning') list = list.filter(t => t.affinity === 'learning');
    else if (filter === 'shelved')  list = list.filter(t => t.affinity === 'shelved');
    // Sort: ★ go-to first, then ◐ learning, then alphabetical (and ◌ shelved
    // sinks to the bottom of any view it appears in).
    const affinityRank = (a: Affinity | null | undefined): number =>
      a === 'go_to' ? 0 : a === 'learning' ? 1 : a === 'shelved' ? 3 : 2;
    return [...list].sort((a, b) => {
      const ar = affinityRank(a.affinity);
      const br = affinityRank(b.affinity);
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });
  }, [tags, filter]);

  const counts = useMemo(() => ({
    total: tags.length,
    goTo: tags.filter(t => t.affinity === 'go_to').length,
    learning: tags.filter(t => t.affinity === 'learning').length,
    shelved: tags.filter(t => t.affinity === 'shelved').length,
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
              Technique Library
            </h2>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
              {counts.total} technique{counts.total === 1 ? '' : 's'}
              {counts.goTo > 0 && ` · ${counts.goTo} go-to`}
              {counts.withVideo > 0 && ` · ${counts.withVideo} with video`}
            </p>
          </div>
        </div>

        {/* Filter pills — affinity-first (mig 027), with a Has video utility chip
            kept around since the original Library was videos-centric. */}
        <div className="flex gap-2 flex-wrap">
          {([
            ['all',         'All',          counts.total],
            ['go_to',       '★ Go-to',      counts.goTo],
            ['learning',    '◐ Learning',   counts.learning],
            ['shelved',     '◌ Shelved',    counts.shelved],
            ['with-video',  'Has video',    counts.withVideo],
          ] as const).map(([val, label, n]) => (
            <button
              key={val}
              onClick={() => { vibrate(6); setFilter(val); }}
              className="text-xs px-3 py-1.5 rounded-full transition-colors touch-manipulation"
              style={{
                backgroundColor: filter === val ? COPPER : SURFACE_2,
                color: filter === val ? 'white' : 'rgba(255,255,255,0.50)',
              }}
            >
              {label} ({n})
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
                onOpen={() => { vibrate(6); navigate(`/techniques/${tag.id}`); }}
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
  /** Primary card tap → navigate to the per-technique Pokedex page. */
  onOpen: () => void;
  /** Inset play-button tap → open VideoPlayerModal in place. */
  onPlay: () => void;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

function MoveCard({ tag, uploading, onOpen, onPlay, onPickFile, onRemove }: MoveCardProps) {
  const hasVideo = !!tag.has_video;
  const inputId = `video-${tag.id}`;

  // Inner controls (play, file picker, remove) all stopPropagation so they
  // don't trigger the outer card's navigate.
  const stop = (e: React.MouseEvent | React.ChangeEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="rounded-xl overflow-hidden flex flex-col j2-press touch-manipulation cursor-pointer"
      style={{
        backgroundColor: SURFACE_2,
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Thumbnail / placeholder */}
      <div
        className="block w-full aspect-video relative"
        style={{ backgroundColor: '#000' }}
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
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)' }}
            />
            {/* Inset play button — only this region triggers playback; the rest
                of the thumbnail still routes the card click to onOpen. */}
            <button
              type="button"
              onClick={e => { stop(e); onPlay(); }}
              aria-label="Play video"
              className="absolute touch-manipulation j2-press"
              style={{
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 44, height: 44, borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.55)',
                border: '1.5px solid rgba(255,255,255,0.85)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: 'white', fontSize: 16, marginLeft: 3 }}>▶</span>
            </button>
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
        {/* Affinity badge — top-left of the thumbnail when set. Mig 027. */}
        {tag.affinity && (
          <span
            aria-label={`affinity: ${tag.affinity.replace('_', ' ')}`}
            className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold"
            style={{
              backgroundColor: 'rgba(196,145,95,0.92)',
              color: '#fff',
              letterSpacing: '0.04em',
            }}
          >
            {tag.affinity === 'go_to' && '★ Go-to'}
            {tag.affinity === 'learning' && '◐ Learning'}
            {tag.affinity === 'shelved' && '◌ Shelved'}
          </span>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <p className="text-xs" style={{ color: COPPER }}>Saving…</p>
          </div>
        )}
      </div>

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

        {/* Action row — Replace / Remove. Both stopPropagation so card-tap
            navigation isn't triggered by these inner controls. */}
        <div className="flex items-center gap-2 mt-1">
          <input
            id={inputId}
            type="file"
            accept="video/*"
            // `capture` prompts the device camera on mobile (intent-based on Android, native sheet on iOS)
            capture="environment"
            className="hidden"
            onClick={stop}
            onChange={e => {
              stop(e);
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = ''; // allow picking the same file again later
            }}
          />
          <label
            htmlFor={inputId}
            onClick={stop}
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
              onClick={e => { stop(e); onRemove(); }}
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
