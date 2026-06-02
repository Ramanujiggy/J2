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

import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../../lib/theme.ts';
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
  // Bar chart: chronological (oldest left) — reverse era.weeks (newest-first)
  const chronological = [...era.weeks].reverse();

  return (
    <button
      onClick={onOpen}
      className="w-full text-left touch-manipulation"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: compact ? '14px 0' : '18px 0',
        borderBottom: '1px solid rgba(196,145,95,0.08)',
        background: 'none',
        border: 'none',
        borderBottomStyle: 'solid',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(196,145,95,0.08)',
        cursor: 'pointer',
      }}
    >
      {/* Left column — duration + date */}
      <div style={{ flexShrink: 0, width: 72, textAlign: 'right', paddingTop: 2 }}>
        <div style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 14, color: 'rgba(196,145,95,0.60)', lineHeight: 1.2 }}>
          {weeksCount === 1 ? 'One week' : `${weeksCount} weeks`}
        </div>
        <div style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 11, color: 'rgba(196,145,95,0.35)', marginTop: 3 }}>
          {new Date(era.lastWk + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* Right column — dot + title + stats */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
          <span
            className="j2-serif-display"
            style={{ fontSize: compact ? 18 : 22, fontWeight: 600, color: PALE_YELLOW, lineHeight: 1.1 }}
          >
            {PILLAR_LABEL[era.focus]}
          </span>
        </div>

        {/* Stats line */}
        <EraStats era={era} chronological={chronological} statsMap={statsMap} color={color} />
      </div>

      {/* Open affordance */}
      <span style={{ fontFamily: FONT_EDITORIAL, fontStyle: 'italic', fontSize: 13, color: COPPER, opacity: 0.5, flexShrink: 0, paddingTop: 4 }}>
        Open →
      </span>
    </button>
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
