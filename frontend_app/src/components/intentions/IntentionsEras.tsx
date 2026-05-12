// IntentionsEras — the "eras" layout for the desktop IntentionsView.
// Consecutive same-focus weeks collapse into chapter cards. Each card has
// a header (eyebrow + focus name), a stats strip with bar chart, and an
// "Open era" CTA.
//
// Three internal pieces:
//   • IntentionsEras (default export) — top-level wrapper + header line
//   • EraCard       (named export)     — one chapter card. Shared between
//                                        desktop and mobile via `compact` prop.
//   • EraStats      (private)          — stats line + per-week alignment bar chart
//
// Pure presentation; state lives in the parent.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import { CARD_BG, COPPER, PALE_YELLOW, SURFACE_3 } from '../../lib/theme.ts';
import { MONTH_NAMES } from '../../lib/constants.ts';
import type { Intention } from '../../types/api.ts';
import {
  FOCUS_COLORS, PILLAR_LABEL,
  type Era, type IntentionStats,
} from './intentionsTypes.ts';

export default function IntentionsEras({ eras, statsMap, onOpen }: { eras: Era[]; statsMap: Map<string, IntentionStats>; onOpen: (e: Era) => void }) {
  return (
    <div>
      <div
        className="j2-serif-italic"
        style={{
          fontSize: 16,
          color: 'rgba(255,255,255,0.65)',
          marginBottom: 26,
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}
      >
        Consecutive weeks on the same focus form an{' '}
        <span style={{ color: COPPER }}>era</span>. Each era is a chapter of your training.
      </div>
      {eras.map((era, idx) => (
        <EraCard
          key={`${era.firstWk}-${era.focus}-${idx}`}
          era={era}
          statsMap={statsMap}
          onOpen={() => onOpen(era)}
        />
      ))}
    </div>
  );
}

export function EraCard({
  era, statsMap, onOpen, compact = false,
}: {
  era: Era;
  statsMap: Map<string, IntentionStats>;
  onOpen: () => void;
  /** Mobile-stacked layout. Defaults to false (desktop 3-column grid). */
  compact?: boolean;
}) {
  const color = FOCUS_COLORS[era.focus];
  const weeksCount = era.weeks.length;

  // Date range — first wk is newest, last wk is oldest (per `computeEras`).
  // For display, show oldest → newest left-to-right.
  const startDate = new Date(era.lastWk + 'T00:00:00');
  const endDate = new Date(era.firstWk + 'T00:00:00');
  const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const eyebrow = weeksCount === 1
    ? `One week · ${fmt(startDate)}`
    : `${weeksCount} weeks · ${fmt(startDate)} → ${fmt(endDate)}`;

  // Bar chart: chronological (oldest left) — reverse era.weeks (newest-first)
  const chronological = [...era.weeks].reverse();

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: CARD_BG,
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: compact ? 12 : 16,
        padding: compact ? '16px 18px' : '24px 28px',
        marginBottom: compact ? 0 : 14,
        overflow: 'hidden',
      }}
    >
      {/* Color sliver */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: color,
          boxShadow: `0 0 12px ${color}80`,
          pointerEvents: 'none',
        }}
      />
      {/* Soft corner glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: compact ? 140 : 200,
          height: compact ? 140 : 200,
          background: `radial-gradient(circle at 100% 0%, ${color}18, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={compact
          ? { display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }
          : { display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 28, alignItems: 'center', position: 'relative' }
        }
      >
        {/* Title */}
        <div style={{ minWidth: 0 }}>
          <div
            className="j2-label-micro"
            style={{
              marginBottom: compact ? 6 : 10,
              fontSize: compact ? 11 : 13,
              letterSpacing: '0.16em',
            }}
          >
            {eyebrow}
          </div>
          <div
            className="j2-serif-display"
            style={{
              fontSize: compact ? 22 : 34,
              fontWeight: 600,
              color: PALE_YELLOW,
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            {PILLAR_LABEL[era.focus]}
            {weeksCount >= 4 && (
              <span
                className="j2-serif-italic"
                style={{ fontSize: compact ? 13 : 17, fontWeight: 500, color: COPPER }}
              >
                · a chapter
              </span>
            )}
          </div>
        </div>

        {/* Stats + bar chart */}
        <EraStats era={era} chronological={chronological} statsMap={statsMap} color={color} />

        {/* Action */}
        <button
          onClick={onOpen}
          style={{
            height: 40,
            padding: '0 18px',
            background: SURFACE_3,
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            color: 'rgba(255,255,255,0.88)',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            transition: 'background 180ms ease',
            whiteSpace: 'nowrap',
            width: compact ? '100%' : 'auto',
            touchAction: 'manipulation',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = SURFACE_3; }}
        >
          Open era →
        </button>
      </div>
    </div>
  );
}

function EraStats({
  era, chronological, statsMap, color,
}: {
  era: Era;
  chronological: Intention[];
  statsMap: Map<string, IntentionStats>;
  color: string;
}) {
  const weeksCount = era.weeks.length;

  // Total sessions across the era. Each session has a single date so it falls
  // in exactly one week — no double-counting.
  const totalSessions = era.weeks.reduce(
    (sum, i) => sum + (statsMap.get(i.id)?.sessionCount ?? 0),
    0,
  );

  // Hours-weighted alignment across the era. The naive simple-mean of weekly
  // scores overstates alignment on uneven eras (e.g., 1h@100% + 10h@50% reads
  // 75% but the true on-focus share is 55%). Quiet weeks with zero hours
  // contribute zero on top *and* bottom, so they correctly drop out.
  let matchSum = 0;
  let totalSum = 0;
  for (const i of era.weeks) {
    const s = statsMap.get(i.id);
    if (!s) continue;
    matchSum += s.matchHours;
    totalSum += s.totalHours;
  }
  const avgAlignment = totalSum > 0 ? Math.round((matchSum / totalSum) * 100) : 0;

  const topLabel = totalSessions > 0
    ? `${weeksCount} ${weeksCount === 1 ? 'week' : 'weeks'} · ${totalSessions} session${totalSessions === 1 ? '' : 's'} · ${avgAlignment}% on focus`
    : `${weeksCount} ${weeksCount === 1 ? 'week' : 'weeks'} of ${PILLAR_LABEL[era.focus]}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div
        className="j2-label-micro"
        style={{ fontSize: 12.5, letterSpacing: '0.14em' }}
      >
        {topLabel}
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
        {chronological.map((wk, idx) => {
          const wkStats = statsMap.get(wk.id);
          const a = wkStats?.alignment ?? 0;
          // Spec: height = 30 + (alignment/100)*70 (% of 24px container)
          //        opacity = 0.4 + (alignment/100)*0.6
          const heightPct = 30 + (a / 100) * 70;
          const opacity = 0.4 + (a / 100) * 0.6;
          const sessionsCount = wkStats?.sessionCount ?? 0;
          return (
            <div
              key={`${wk.id}-${idx}`}
              title={`${wk.week_start.slice(0, 10)} · ${sessionsCount} session${sessionsCount === 1 ? '' : 's'} · ${a}%`}
              style={{
                flex: 1,
                minWidth: 4,
                maxWidth: 16,
                height: `${heightPct}%`,
                background: color,
                opacity,
                borderRadius: 1,
                transition: 'height 240ms ease, opacity 240ms ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
