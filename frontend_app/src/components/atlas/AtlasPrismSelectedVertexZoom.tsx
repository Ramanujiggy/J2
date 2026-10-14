// AtlasPrismSelectedVertexZoom — the bottom subtree of AtlasPrismPanel,
// rendered only when the active sub-view is 'prism' (the pentagon shape
// view where a vertex tap is meaningful). Two-section layout:
//   1. Header row — selected-vertex label + description + 4-stat metadata strip
//   2. Two columns — Recent sessions for this vertex | Intentions for this focus
//
// Hidden on non-Shape sub-views (volume / weekly / split / format) since the
// donut and bar charts have no clickable per-pillar surface — the section
// would just freeze on whatever vertex was last chosen.
//
// Pure presentation; every piece of data is computed in the parent.
// Extracted from AtlasPage.tsx during the 2026-05-09 refactor pass.

import { addDays, formatDuration, toDateString } from '../../lib/sessionUtils.ts';
import { formatWeekShort, type AlignmentResult } from '../../lib/analyticsUtils.ts';
import { FONT_EDITORIAL, INT_COLORS, PALE_YELLOW, TEXT_PRIMARY, TEXT_BODY, TEXT_TERTIARY, TEXT_HINT, TEXT_DISABLED } from '../../lib/theme.ts';
import type { Intention, SessionSummary } from '../../types/api.ts';

interface Props {
  selectedTag: string;
  selectedLabel: string;
  description: string;
  selected: { count: number; minutes: number; intensitySum: number };
  totalCount: number;
  weeksAsFocus: number;
  avgIntensity: number;
  windowLabel: string;
  isAllTime: boolean;
  recentSessions: SessionSummary[];
  focusIntentions: { intention: Intention; alignment: AlignmentResult }[];
  isDesktop: boolean;
  onOpenSession: (id: string) => void;
  onOpenIntentionJournal: (id: string) => void;
}

export default function AtlasPrismSelectedVertexZoom({
  selectedTag: _selectedTag,  // retained in interface for symmetry / future use
  selectedLabel,
  description,
  selected,
  totalCount,
  weeksAsFocus,
  avgIntensity,
  windowLabel,
  isAllTime,
  recentSessions,
  focusIntentions,
  isDesktop,
  onOpenSession,
  onOpenIntentionJournal,
}: Props) {
  void _selectedTag;
  return (
    <div
      style={{
        marginTop: isDesktop ? 80 : 48,
        paddingTop: isDesktop ? 40 : 28,
        borderTop: '1px solid rgba(196,145,95,0.18)',
      }}
    >
      {/* Header row: label + name + stat metadata strip */}
      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          alignItems: isDesktop ? 'flex-end' : 'flex-start',
          justifyContent: 'space-between',
          gap: isDesktop ? 32 : 14,
          marginBottom: isDesktop ? 28 : 20,
          paddingBottom: isDesktop ? 20 : 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="j2-label-copper" style={{ marginBottom: 6 }}>◇ Selected vertex</div>
          <div className="j2-serif-display j2-heading-glow" style={{ fontSize: isDesktop ? 53 : 38, lineHeight: 1 }}>
            {selectedLabel}
          </div>
          <p
            style={{
              fontSize: isDesktop ? 17 : 16, lineHeight: 1.55,
              color: TEXT_TERTIARY,
              marginTop: 8, marginBottom: 0,
              maxWidth: isDesktop ? 540 : 'none',
            }}
          >
            {description}
          </p>
        </div>

        {/* Inline stat strip — 4 small readouts */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, auto)',
            columnGap: isDesktop ? 34 : 22,
            rowGap: 4,
            flexShrink: 0,
          }}
        >
          {([
            {
              k: 'Sessions',
              v: Math.round(selected.count),
              sub: totalCount > 0 && selected.count > 0
                ? `${Math.round(selected.count / totalCount * 100)}% of mat time`
                : (isAllTime ? 'none yet' : 'none in window'),
            },
            {
              k: 'Hours',
              v: Math.round(selected.minutes / 60),
              sub: windowLabel,
            },
            {
              k: 'Weeks as focus',
              v: weeksAsFocus,
              sub: weeksAsFocus === 1 ? 'week set this intent' : 'weeks set this intent',
            },
            {
              k: 'Avg intensity',
              v: selected.count > 0 ? avgIntensity.toFixed(1) : '—',
              sub: selected.count > 0 ? 'on a 5-point scale' : 'log one to see',
            },
          ]).map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="j2-label-micro" style={{ fontSize: 12, marginBottom: 2 }}>{s.k}</div>
              <div
                style={{
                  fontSize: isDesktop ? 29 : 24, fontFamily: FONT_EDITORIAL, fontWeight: 600,
                  color: PALE_YELLOW, lineHeight: 1,
                }}
              >
                {s.v}
              </div>
              <div
                style={{
                  fontSize: 12, color: TEXT_TERTIARY,
                  marginTop: 2, letterSpacing: '0.06em',
                }}
              >
                {s.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Recent sessions | Intentions for this focus */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr',
          gap: isDesktop ? 32 : 24,
        }}
      >
        {/* Left column — Recent sessions */}
        <div>
          <div className="j2-label-copper" style={{ marginBottom: 14 }}>
            ◈ Recent sessions
          </div>
          {recentSessions.length === 0 ? (
            <p style={{ fontSize: 16, color: TEXT_HINT, fontStyle: 'italic' }}>
              {isAllTime
                ? 'No sessions logged with this focus yet.'
                : `No ${selectedLabel} sessions in this window.`}
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: isDesktop ? 12 : 10,
              }}
            >
              {recentSessions.map(s => {
                const dateStr = typeof s.date === 'string' ? s.date.slice(0, 10) : toDateString(new Date(s.date));
                const d = new Date(dateStr + 'T00:00:00');
                const intensity = Math.max(1, Math.min(5, s.intensity ?? 3));
                const intColor = INT_COLORS[intensity as 1 | 2 | 3 | 4 | 5] ?? '#5E8A5C';
                return (
                  <button
                    key={s.id}
                    onClick={() => onOpenSession(s.id)}
                    style={{
                      padding: isDesktop ? 16 : 14,
                      background: 'var(--j2-surface-2)',
                      border: '1px solid var(--j2-border-1)',
                      borderRadius: 12,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background 160ms ease, transform 160ms ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'var(--j2-surface-2)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="j2-label-micro" style={{ fontSize: 12 }}>
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: intColor,
                          boxShadow: `0 0 8px ${intColor}60`,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontSize: 17, fontFamily: FONT_EDITORIAL,
                          color: TEXT_PRIMARY,
                        }}
                      >
                        {formatDuration(s.duration ?? 0)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column — Intentions for this focus */}
        <div>
          <div className="j2-label-copper" style={{ marginBottom: 16 }}>
            ◇ Intentions for {selectedLabel}
          </div>
          {focusIntentions.length === 0 ? (
            <p style={{ fontSize: 16, color: TEXT_HINT, fontStyle: 'italic' }}>
              No intentions have targeted this pillar yet.
            </p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--j2-surface-2)', border: '1px solid var(--j2-border-1)' }}>
              {focusIntentions.map(({ intention, alignment }, i) => {
                const endDate = addDays(intention.week_start, intention.duration_days);
                return (
                  <button
                    key={intention.id}
                    onClick={() => onOpenIntentionJournal(intention.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'transparent',
                      border: 'none',
                      borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 160ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div
                      style={{
                        width: 5, height: 28, borderRadius: 999,
                        backgroundColor:
                          alignment.status === 'aligned'  ? 'rgba(82,181,108,0.70)'
                        : alignment.status === 'diverged' ? 'rgba(218,116,34,0.50)'
                        : 'rgba(255,255,255,0.06)',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 16, fontWeight: 600,
                          color: TEXT_BODY,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {intention.intent_label || selectedLabel}
                      </div>
                      <div style={{ fontSize: 13, color: TEXT_HINT, marginTop: 2 }}>
                        {formatWeekShort(intention.week_start)} – {formatWeekShort(endDate)}
                      </div>
                    </div>
                    {alignment.status !== 'no-data' ? (
                      <span
                        style={{
                          fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                          backgroundColor:
                            alignment.status === 'aligned' ? 'rgba(82,181,108,0.12)' : 'rgba(218,116,34,0.12)',
                          color:
                            alignment.status === 'aligned' ? 'rgba(82,181,108,0.85)' : 'rgba(218,116,34,0.75)',
                          flexShrink: 0,
                        }}
                      >
                        {alignment.score !== null ? `${alignment.score}%` : (alignment.status === 'aligned' ? 'Aligned' : 'Diverged')}
                      </span>
                    ) : (
                      <span style={{ fontSize: 13, fontStyle: 'italic', color: TEXT_DISABLED, flexShrink: 0 }}>
                        No data
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
