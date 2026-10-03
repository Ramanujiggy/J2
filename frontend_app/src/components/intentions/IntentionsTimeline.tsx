// IntentionsTimeline — the editorial timeline layout for the desktop
// IntentionsView. Renders one row per ISO week of the selected year, with
// month headers between months and a "Mostly" focus marker at the top.
//
// Three internal pieces, kept together because they share the same grid
// (TIMELINE_COLUMNS) and only render together:
//   • IntentionsTimeline (default export)
//   • MonthHeader        — section header before each month transition
//   • EmptyWeekRow       — muted "no focus set" row for weeks without an intention
//   • IntentionRow       — full row for weeks with an intention (date / dot / name / sessions / alignment / open)
//
// Pure presentation; state lives in the parent.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import { useState } from 'react';
import { COPPER, COPPER_BORDER, FONT_EDITORIAL, PALE_YELLOW } from '../../lib/theme.ts';
import { MONTH_NAMES } from '../../lib/constants.ts';
import type { Intention, Pillar } from '../../types/api.ts';
import {
  ALL_PILLARS, FOCUS_COLORS, PILLAR_LABEL,
  type IntentionStats, type TimelineRow,
} from './intentionsTypes.ts';

// Shared timeline grid — IntentionRow and EmptyWeekRow must use the same
// column template so they line up under the month header. Bumped from the
// original 88/14/1fr/90/240/80 to give more room to the focus name + alignment.
const TIMELINE_COLUMNS = '74px 14px 1fr 110px 260px 90px';
const TIMELINE_GAP = 20;

interface IntentionsTimelineProps {
  rows: TimelineRow[];
  statsMap: Map<string, IntentionStats>;
  sessionsByWeek: Map<string, number>;
  onOpen: (i: Intention) => void;
}

export default function IntentionsTimeline({ rows, statsMap, sessionsByWeek, onOpen }: IntentionsTimelineProps) {
  // Dominant focus across the rendered (year-scoped) rows — the "Mostly"
  // marker that used to hang off the year header. Lives at the top of the
  // timeline now since the year header itself is gone (year is in the tabs).
  const dominant = (() => {
    const counts: Partial<Record<Pillar, number>> = {};
    for (const r of rows) {
      if (r.type !== 'intention') continue;
      const h = r.intention.heading;
      if (h && (ALL_PILLARS as string[]).includes(h)) {
        const k = h as Pillar;
        counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    const top = (Object.entries(counts) as [Pillar, number][])
      .sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? null;
  })();

  // Group rows by month so we can inject a section header before each month
  // change. `rows` is newest-first (see IntentionsPage), so months arrive in
  // reverse chronological order — that matches the rest of the timeline.
  const monthOf = (weekStart: string) => weekStart.slice(0, 7); // "YYYY-MM"

  return (
    <div>
      {dominant && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 12,
            paddingBottom: 18,
            fontFamily: FONT_EDITORIAL,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: COPPER,
            }}
          >
            Mostly
          </span>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              background: FOCUS_COLORS[dominant],
              boxShadow: `0 0 10px ${FOCUS_COLORS[dominant]}90`,
            }}
          />
          <span
            className="j2-serif-italic"
            style={{
              fontSize: 22,
              fontStyle: 'italic',
              color: PALE_YELLOW,
              letterSpacing: '-0.005em',
              lineHeight: 1,
            }}
          >
            {PILLAR_LABEL[dominant]}
          </span>
        </div>
      )}
      <div>
        {rows.map((row, idx) => {
          const prevRow = idx > 0 ? rows[idx - 1] : null;
          const currMonth = monthOf(row.weekStart);
          const prevMonth = prevRow ? monthOf(prevRow.weekStart) : null;
          const isMonthStart = currMonth !== prevMonth;

          return (
            <div key={row.type === 'intention' ? row.intention.id : `empty-${row.weekStart}`}>
              {isMonthStart && <MonthHeader weekStart={row.weekStart} isFirst={idx === 0} />}
              {row.type === 'intention' ? (
                <IntentionRow
                  intention={row.intention}
                  stats={statsMap.get(row.intention.id) ?? { sessionCount: 0, alignment: 0, matchHours: 0, totalHours: 0 }}
                  onOpen={() => onOpen(row.intention)}
                />
              ) : (
                <EmptyWeekRow
                  weekStart={row.weekStart}
                  sessionCount={sessionsByWeek.get(row.weekStart) ?? 0}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Month divider — a serif month name + faint hairline, sized to read as a
// section header (not a kicker). Sits just above the first row of each month.
function MonthHeader({ weekStart, isFirst }: { weekStart: string; isFirst: boolean }) {
  const d = new Date(weekStart + 'T00:00:00');
  const monthName = MONTH_NAMES[d.getMonth()] ?? '';
  const year = d.getFullYear();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 16,
        paddingTop: isFirst ? 4 : 28,
        paddingBottom: 12,
        marginTop: isFirst ? 0 : 8,
        borderTop: isFirst ? 'none' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h3
        className="j2-serif-display"
        style={{
          fontSize: 22,
          margin: 0,
          paddingTop: isFirst ? 0 : 16,
          color: PALE_YELLOW,
          letterSpacing: '-0.005em',
          lineHeight: 1,
          fontWeight: 500,
        }}
      >
        {monthName}
      </h3>
      <span
        style={{
          paddingTop: isFirst ? 0 : 16,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.32)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {year}
      </span>
    </div>
  );
}

// Empty-week placeholder row in the 52-week timeline. Keeps the same grid as
// IntentionRow so columns line up; everything is muted to read as absence
// without competing visually with set weeks.
function EmptyWeekRow({ weekStart, sessionCount }: { weekStart: string; sessionCount: number }) {
  const d = new Date(weekStart + 'T00:00:00');
  // Month is now in MonthHeader, so the date column just shows the day.
  const dayLabel = `WK ${d.getDate()}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TIMELINE_COLUMNS,
        gap: TIMELINE_GAP,
        alignItems: 'center',
        padding: '16px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.32)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
        }}
      >
        {dayLabel}
      </div>
      {/* Hollow dash where the focus dot would be */}
      <div style={{ width: 10, height: 1, background: 'rgba(255,255,255,0.15)' }} />
      <div
        className="j2-serif-italic"
        style={{
          fontSize: 22,
          fontStyle: 'italic',
          color: 'rgba(255,255,255,0.32)',
          lineHeight: 1.1,
        }}
      >
        No focus set
      </div>
      <div
        style={{
          fontSize: 14,
          color: sessionCount > 0 ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.22)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {sessionCount === 0 ? '—' : `${sessionCount} ${sessionCount === 1 ? 'session' : 'sessions'}`}
      </div>
      <div />
      <div />
    </div>
  );
}

function IntentionRow({
  intention,
  stats,
  onOpen,
}: {
  intention: Intention;
  stats: IntentionStats;
  onOpen: () => void;
}) {
  const heading = intention.heading as Pillar | null;
  const color = heading ? FOCUS_COLORS[heading] : 'rgba(255,255,255,0.30)';
  const focusName = heading ? PILLAR_LABEL[heading] : (intention.intent_label || 'No focus');

  // Date — month is now in MonthHeader, so the row just shows the day number.
  const start = intention.week_start.slice(0, 10);
  const d = new Date(start + 'T00:00:00');
  const dayLabel = `WK ${d.getDate()}`;
  const fullDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });

  // Hover state (CSS-only via inline JS hover for the simple bg + arrow color)
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: TIMELINE_COLUMNS,
        gap: TIMELINE_GAP,
        alignItems: 'center',
        padding: '18px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backgroundColor: hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        transition: 'background-color 160ms ease',
      }}
    >
      {/* Date — day-of-month only; month sits in the section header above */}
      <div
        style={{
          fontSize: 14,
          color: 'rgba(255,255,255,0.62)',
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
        }}
      >
        {dayLabel}
      </div>

      {/* Vertex dot */}
      <div
        style={{
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: color,
          boxShadow: heading ? `0 0 8px ${color}80` : 'none',
        }}
      />

      {/* Focus name */}
      <div
        className="j2-serif-display"
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: PALE_YELLOW,
          lineHeight: 1.1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.005em',
        }}
      >
        {focusName}
      </div>

      {/* Session count */}
      <div
        style={{
          fontSize: 15,
          color: 'rgba(255,255,255,0.72)',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {stats.sessionCount} {stats.sessionCount === 1 ? 'session' : 'sessions'}
        {(intention.user_tag_ids?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, color: COPPER_BORDER, marginLeft: 8 }}>
            · {intention.user_tag_ids!.length} tech{intention.user_tag_ids!.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alignment bar — real % from statsMap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            flex: 1,
            height: 4,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${stats.alignment}%`,
              height: '100%',
              background: color,
              borderRadius: 2,
              boxShadow: stats.alignment > 0 ? `0 0 6px ${color}80` : 'none',
              transition: 'width 240ms ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 13.5,
            color: 'rgba(255,255,255,0.58)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: 42,
            textAlign: 'right',
            fontWeight: 500,
          }}
        >
          {stats.alignment}%
        </span>
      </div>

      {/* Action */}
      <button
        onClick={onOpen}
        title={fullDate}
        style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          color: hovered ? COPPER : 'rgba(255,255,255,0.50)',
          textAlign: 'right',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          transition: 'color 160ms ease',
        }}
      >
        Open →
      </button>
    </div>
  );
}
