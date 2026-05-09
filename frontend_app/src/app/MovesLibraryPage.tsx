// MovesLibraryPage — personal Technique Library (route stays `/library` for
// URL stability; the page header reads "Technique Library" per migration 027).
//
// Layout: five collapsible pillar sections (Stand-up, Passing, Guard, Pins,
// Submissions). All five always render — even empty ones — because the
// pillars *are* the organizing structure of the app, and hiding one would
// feel like a missing feature. Empty pillars expand to a graceful empty
// state instead of a flat list.
//
// Each row inside a pillar is a navigation-only line item:
//   [thumb]  Technique name  affinity-glyph  duration  →
// Tap a row → /techniques/:id (the Pokedex). Video playback, attach, replace,
// and remove all live on the Pokedex. The library is browse-only.
//
// Filter chips at the top (All / ★ / ◐ / ◌ / Has video) apply globally:
// every section's count + visible rows reflect the active filter.
//
// Tier 1 (free, default, mig 010): video files live in browser storage; only
// the thumbnail + metadata sync via the server.

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContent from '../components/PageContent.tsx';
import LibraryEmptyHero from '../components/empty/LibraryEmptyHero.tsx';
import { useUserTags } from '../hooks/useUserTags.ts';
import { useIsDesktop } from '../hooks/useIsDesktop.ts';
import { PALE_YELLOW, GLOW_SOFT, COPPER, SURFACE_2, SURFACE_3, CARD_BG } from '../lib/theme.ts';
import { formatDurationMMSS } from '../lib/videoUtils.ts';
import { vibrate } from '../lib/haptics.ts';
import { ChevronLeft, ChevronRight, ChevronDown, Video } from 'lucide-react';
import type { UserTag, Pillar, Affinity } from '../types/api.ts';

const PILLAR_LABELS: Record<Pillar, string> = {
  standup: 'Stand-up',
  passing: 'Passing',
  pins: 'Pins',
  submissions: 'Submissions',
  guard: 'Guard',
};
const PILLAR_ORDER: Pillar[] = ['standup', 'passing', 'guard', 'pins', 'submissions'];

type LibraryFilter = 'all' | 'go_to' | 'learning' | 'shelved' | 'with-video';

// Sort comparator — ★ go-to first, then ◐ learning, then untouched, then ◌
// shelved. Alpha within each tier. Used inside every pillar section so the
// "most relevant to me" techniques bubble to the top of each.
function affinityRank(a: Affinity | null | undefined): number {
  return a === 'go_to' ? 0 : a === 'learning' ? 1 : a === 'shelved' ? 3 : 2;
}

function sortByAffinityThenName(list: UserTag[]): UserTag[] {
  return [...list].sort((a, b) => {
    const ar = affinityRank(a.affinity);
    const br = affinityRank(b.affinity);
    if (ar !== br) return ar - br;
    return a.name.localeCompare(b.name);
  });
}

function matchesFilter(tag: UserTag, filter: LibraryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'with-video') return !!tag.has_video;
  return tag.affinity === filter;
}

export default function MovesLibraryPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { tags, loading, error } = useUserTags();

  const [filter, setFilter] = useState<LibraryFilter>('all');
  // Section state is local to the page (not persisted across navigation).
  // All sections collapsed by default — the user opens what they want.
  const [expanded, setExpanded] = useState<Set<Pillar>>(() => new Set());

  const togglePillar = useCallback((p: Pillar) => {
    vibrate(6);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  // Pre-bucket tags by pillar (filtered + sorted) so each section just renders.
  // We compute filtered counts here so the section header chevron can show
  // the count under the active filter.
  const sections = useMemo(() => {
    const buckets: Record<Pillar, UserTag[]> = {
      standup: [], passing: [], pins: [], submissions: [], guard: [],
    };
    for (const t of tags) {
      if (matchesFilter(t, filter)) buckets[t.parent_pillar].push(t);
    }
    for (const p of PILLAR_ORDER) buckets[p] = sortByAffinityThenName(buckets[p]);
    return buckets;
  }, [tags, filter]);

  // Top-of-page summary numbers — always reflect the *unfiltered* totals so
  // the user sees the whole picture at a glance. Filter chips below show
  // their own per-state counts.
  const counts = useMemo(() => ({
    total: tags.length,
    goTo: tags.filter(t => t.affinity === 'go_to').length,
    learning: tags.filter(t => t.affinity === 'learning').length,
    shelved: tags.filter(t => t.affinity === 'shelved').length,
    withVideo: tags.filter(t => t.has_video).length,
  }), [tags]);

  // Recently added — newest 8 user_tags by created_at. Drives the ribbon at
  // the top of the page so a returning user sees something tappable instead
  // of a wall of collapsed accordion headers. Independent of the filter
  // chips below: ribbon always shows recent additions, regardless of which
  // affinity filter is active.
  const recentTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => {
        const cmp = (b.created_at ?? '').localeCompare(a.created_at ?? '');
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [tags]);

  return (
    <PageContent ready={!loading} loadingMessages={['Loading the library...']}>
      <div
        className={`space-y-5 ${isDesktop ? 'j2-page-container' : 'mx-auto max-w-5xl px-4 sm:px-6'}`}
        style={isDesktop ? { paddingTop: 20, paddingBottom: 20 } : { paddingTop: 24, paddingBottom: 24 }}
      >

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

        {/* Recently added ribbon — horizontal scroll of the newest 8 user_tags.
            Gives returning users an immediate tap target without forcing them
            to drill into the accordion. Hidden when the user has < 3 tags
            (the accordion below already surfaces those prominently — a
            2-card ribbon would look accidental). */}
        {recentTags.length >= 3 && (
          <RecentlyAddedRibbon
            tags={recentTags}
            onOpenTechnique={id => navigate(`/techniques/${id}`)}
          />
        )}

        {/* Filter pills — affinity-first (mig 027). Counts in each chip
            reflect the global library; tapping a chip filters every pillar
            section's row list simultaneously. */}
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

        {/* Empty-library hero — only fires when the user has zero techniques
            anywhere. Once they have any, we show the accordion (some pillars
            may still be empty individually — those render an inline empty
            state inside their expanded body). */}
        {!loading && tags.length === 0 && <LibraryEmptyHero />}

        {/* Pillar accordion */}
        {tags.length > 0 && (
          <div
            style={{
              background: CARD_BG,
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14,
              overflow: 'hidden',
            }}
          >
            {PILLAR_ORDER.map((p, idx) => (
              <PillarSection
                key={p}
                pillar={p}
                tags={sections[p]}
                expanded={expanded.has(p)}
                onToggle={() => togglePillar(p)}
                onOpenTechnique={id => navigate(`/techniques/${id}`)}
                isFirst={idx === 0}
                filterActive={filter !== 'all'}
              />
            ))}
          </div>
        )}
      </div>
    </PageContent>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PillarSection — one accordion section per pillar.
// ─────────────────────────────────────────────────────────────────────────────

interface PillarSectionProps {
  pillar: Pillar;
  /** The pillar's filtered, sorted tag list. May be empty. */
  tags: UserTag[];
  expanded: boolean;
  onToggle: () => void;
  onOpenTechnique: (id: string) => void;
  isFirst: boolean;
  /** True when the user has selected a non-"All" filter. Affects empty-state copy. */
  filterActive: boolean;
}

function PillarSection({
  pillar, tags, expanded, onToggle, onOpenTechnique, isFirst, filterActive,
}: PillarSectionProps) {
  const goToCount = tags.filter(t => t.affinity === 'go_to').length;

  return (
    <section
      style={{
        borderTop: isFirst ? 'none' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header — full-width button, hover/active feedback. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="touch-manipulation"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            color: 'rgba(255,255,255,0.45)',
            transition: 'transform 160ms ease',
          }}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display, Georgia, serif)',
            fontSize: 20,
            fontWeight: 500,
            color: PALE_YELLOW,
            letterSpacing: '-0.005em',
            flex: 1,
            minWidth: 0,
          }}
        >
          {PILLAR_LABELS[pillar]}
        </span>
        {/* Counts: total in section + go-to subtotal when present. */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.04em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {tags.length}
        </span>
        {goToCount > 0 && (
          <span
            aria-label={`${goToCount} go-to`}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(196,145,95,0.14)',
              color: COPPER,
              letterSpacing: '0.04em',
            }}
          >
            ★ {goToCount}
          </span>
        )}
      </button>

      {/* Body — only mounted when expanded. */}
      {expanded && (
        <div
          style={{
            paddingBottom: 6,
            borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(0,0,0,0.10)',
          }}
        >
          {tags.length === 0 ? (
            <p
              style={{
                padding: '20px 22px',
                fontSize: 13,
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.40)',
                lineHeight: 1.5,
              }}
            >
              {filterActive
                ? `No ${PILLAR_LABELS[pillar].toLowerCase()} techniques match this filter.`
                : `No ${PILLAR_LABELS[pillar].toLowerCase()} techniques yet — add one from the Log Session form.`}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tags.map(tag => (
                <li key={tag.id}>
                  <TechniqueRow
                    tag={tag}
                    onOpen={() => onOpenTechnique(tag.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TechniqueRow — one line item inside a pillar section.
// ─────────────────────────────────────────────────────────────────────────────

function TechniqueRow({ tag, onOpen }: { tag: UserTag; onOpen: () => void }) {
  const hasVideo = !!tag.has_video && !!tag.video_thumbnail;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="j2-press touch-manipulation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '10px 18px',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {/* Thumbnail / placeholder — fixed-width slot keeps rows aligned. */}
      <div
        style={{
          width: 56,
          height: 40,
          flexShrink: 0,
          borderRadius: 6,
          background: hasVideo
            ? `url(${tag.video_thumbnail}) center / cover no-repeat`
            : SURFACE_3,
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {!hasVideo && (
          <Video size={16} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.18)' }} />
        )}
      </div>

      {/* Name + affinity inline */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.88)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tag.name}
        </span>
        {tag.affinity && <AffinityInline value={tag.affinity} />}
      </div>

      {/* Duration — only when video exists */}
      {tag.video_duration_seconds != null && (
        <span
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.45)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {formatDurationMMSS(tag.video_duration_seconds)}
        </span>
      )}

      <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.30)', flexShrink: 0 }} />
    </button>
  );
}

function AffinityInline({ value }: { value: Affinity }) {
  const styles =
    value === 'go_to' ? { glyph: '★', label: 'Go-to', color: COPPER } :
    value === 'learning' ? { glyph: '◐', label: 'Learning', color: 'rgba(196,145,95,0.65)' } :
    { glyph: '◌', label: 'Shelved', color: 'rgba(255,255,255,0.30)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: styles.color,
        letterSpacing: '0.04em',
      }}
    >
      <span aria-hidden>{styles.glyph}</span>
      {styles.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentlyAddedRibbon — horizontal scroll of the newest user_tags.
// Pattern: artifact-library home page (recipe / plant / wine apps). The top
// of the page shows fresh items as poster-style cards so a returning user
// has something to engage with without drilling into the accordion below.
// ─────────────────────────────────────────────────────────────────────────────

function RecentlyAddedRibbon({
  tags,
  onOpenTechnique,
}: {
  tags: UserTag[];
  onOpenTechnique: (id: string) => void;
}) {
  return (
    <section aria-label="Recently added techniques">
      <div className="j2-label-copper" style={{ marginBottom: 10 }}>
        ◇ Recently added
      </div>

      {/* Horizontal scroll container. `scroll-snap-type: x proximity` makes
          mobile flicks land cleanly on a card edge without forcing snap on
          desktop trackpad scrolls. `WebkitOverflowScrolling: touch` keeps
          the iOS momentum scroll feeling native. The negative margin /
          padding pair is the standard "rail breakout" trick — lets cards
          flow off the right edge so a peek of the next card is visible
          without breaking the page container. */}
      <div
        style={{
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollSnapType: 'x proximity',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          marginInline: -4,        // counter the inner card-row padding-inline
          paddingInline: 4,
          paddingBottom: 4,        // room for card hover lift if we add one
        }}
      >
        {/* Hide the scrollbar in WebKit too (the scrollbarWidth above only
            covers Firefox / standard). */}
        <style>{`
          [data-recently-added-scroll]::-webkit-scrollbar { display: none; }
        `}</style>
        <div
          data-recently-added-scroll
          style={{
            display: 'flex',
            gap: 12,
            // Trailing 24px so the last card has breathing room and hints
            // at scrollability via its right edge.
            paddingRight: 24,
          }}
        >
          {tags.map(tag => (
            <RecentCard
              key={tag.id}
              tag={tag}
              onOpen={() => onOpenTechnique(tag.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecentCard — one poster tile inside the ribbon.
// ─────────────────────────────────────────────────────────────────────────────

function RecentCard({ tag, onOpen }: { tag: UserTag; onOpen: () => void }) {
  const hasThumb = !!tag.video_thumbnail;
  const PILLAR_LABEL = PILLAR_LABELS[tag.parent_pillar];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="j2-press touch-manipulation"
      style={{
        flex: '0 0 auto',
        width: 140,
        scrollSnapAlign: 'start',
        background: CARD_BG,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 0,
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Square thumbnail (1:1) — works for both video clips and the empty
          placeholder. 16:9 would letterbox awkwardly inside a narrow card. */}
      <div
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: hasThumb
            ? `url(${tag.video_thumbnail}) center / cover no-repeat`
            : SURFACE_2,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!hasThumb && (
          <Video size={26} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.18)' }} />
        )}
        {/* Affinity badge, if set — overlays the top-left of the thumbnail
            so it's visible at a glance during a quick scroll. Mirrors the
            in-row affinity inline; placement matches the per-card badge
            from the prior MoveCard treatment. */}
        {tag.affinity && (
          <span
            aria-label={`affinity: ${tag.affinity.replace('_', ' ')}`}
            style={{
              position: 'absolute',
              top: 6, left: 6,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(196,145,95,0.92)',
              color: '#fff',
              letterSpacing: '0.04em',
            }}
          >
            {tag.affinity === 'go_to' && '★'}
            {tag.affinity === 'learning' && '◐'}
            {tag.affinity === 'shelved' && '◌'}
          </span>
        )}
      </div>

      {/* Body — name + pillar label */}
      <div
        style={{
          padding: '8px 10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minHeight: 56,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            lineHeight: 1.25,
            // Two-line truncate. -webkit-line-clamp is non-standard but
            // universally supported in production browsers; on the rare
            // edge case it isn't, the text just wraps without a clamp.
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {tag.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.40)',
          }}
        >
          {PILLAR_LABEL}
        </span>
      </div>
    </button>
  );
}
