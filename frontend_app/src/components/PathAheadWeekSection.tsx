// PathAheadWeekSection — the "this week" subtree shared by desktop + mobile.
//
// Two stacked pieces:
//   1. Header — week-label + prev/next nav + carousel/list view toggle
//   2. Content — either WeekIndicators (carousel) or a flat list of the
//      week's sessions, with an empty-state when no sessions logged
//
// Pure presentation — every piece of state and every callback is passed
// in. The empty-state's "Today — Mat Time" CTA only appears when
// weekOffset === 0 AND today has no sessions yet, so the parent's
// `today`-aware data is needed alongside the displayed week.
//
// Extracted from PathAheadPage.tsx during the 2026-05-09 refactor pass.

import { CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react';
import WeekIndicators from './WeekIndicators.tsx';
import { CARD_BG, COPPER, SURFACE_2, WHISPER_BORDER, TEXT_PRIMARY, TEXT_TERTIARY, TEXT_HINT, TEXT_DISABLED } from '../lib/theme.ts';
import { SKILL_TAGS, MONTH_NAMES } from '../lib/constants.ts';
import { toDateString, formatDuration, DAY_NAMES, INTENSITY_COLOR, SESSION_TYPE_LABELS, formatGiNogi } from '../lib/sessionUtils.ts';
import type { SessionSummary } from '../types/api.ts';

export type WeekViewMode = 'carousel' | 'list';

interface DaySessionEntry {
  session: SessionSummary;
  day: Date;
  dayStr: string;
}

interface Props {
  // Header
  weekOffset: number;
  weekLabel: string;
  weekView: WeekViewMode;
  onWeekOffsetChange: (next: number | ((prev: number) => number)) => void;
  onWeekViewChange: (mode: WeekViewMode) => void;
  // Body
  displayWeekDays: Date[];
  today: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  weekSessionsList: DaySessionEntry[];
  // Callbacks — parent handles the intention/activeIntention bookkeeping
  // and passes us only the call handlers we need.
  onLogTap: (date?: string) => void;
  onDayTap: (day: Date, sessions: SessionSummary[]) => void;
  onSessionTap: (entry: DaySessionEntry) => void;
  // Visual: extra gap between header and body. Desktop's existing layout
  // wraps the body in a `marginTop: 16` div on top of the header's own
  // 8px marginBottom; mobile renders them flush. Defaults to 0 for mobile.
  bodyMarginTop?: number;
}

export default function PathAheadWeekSection({
  weekOffset,
  weekLabel,
  weekView,
  onWeekOffsetChange,
  onWeekViewChange,
  displayWeekDays,
  today,
  sessionsByDate,
  weekSessionsList,
  onLogTap,
  onDayTap,
  onSessionTap,
  bodyMarginTop = 0,
}: Props) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        {/* Week label + prev/next navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onWeekOffsetChange((o: number) => Math.max(-2, o - 1))}
            disabled={weekOffset <= -2}
            className="flex items-center justify-center rounded-md touch-manipulation"
            style={{
              width: 26, height: 26,
              color: weekOffset <= -2 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
              transition: 'color 150ms ease',
            }}
            aria-label="Previous week"
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>
          <button
            onClick={() => onWeekOffsetChange(0)}
            className="text-sm font-semibold uppercase tracking-wide touch-manipulation"
            style={{
              color: weekOffset === 0 ? 'rgba(255,255,255,0.4)' : COPPER,
              letterSpacing: '0.06em',
              minWidth: 72,
              textAlign: 'center',
            }}
            aria-label="Return to current week"
          >
            {weekLabel}
          </button>
          <button
            onClick={() => onWeekOffsetChange((o: number) => Math.min(1, o + 1))}
            disabled={weekOffset >= 1}
            className="flex items-center justify-center rounded-md touch-manipulation"
            style={{
              width: 26, height: 26,
              color: weekOffset >= 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)',
              transition: 'color 150ms ease',
            }}
            aria-label="Next week"
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>
        {/* View mode toggle */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: SURFACE_2, border: '1px solid rgba(255,255,255,0.06)' }}>
          {([
            { id: 'carousel' as const, Icon: CalendarDays },
            { id: 'list' as const, Icon: List },
          ]).map(({ id, Icon }) => {
            const isActive = weekView === id;
            return (
              <button
                key={id}
                onClick={() => onWeekViewChange(id)}
                className="flex items-center justify-center rounded-md transition-colors touch-manipulation"
                style={{
                  width: 34,
                  height: 30,
                  backgroundColor: isActive ? COPPER : 'transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                  transition: 'background-color 200ms ease, color 200ms ease',
                }}
                aria-label={id === 'carousel' ? 'Calendar view' : 'List view'}
              >
                <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={bodyMarginTop ? { marginTop: bodyMarginTop } : undefined}>
      {weekView === 'carousel' ? (
        <WeekIndicators
          weekDays={displayWeekDays}
          today={today}
          sessionsByDate={sessionsByDate}
          onDayTap={(day, sessions) => onDayTap(day, sessions)}
          onLogTap={(day) => onLogTap(toDateString(day))}
        />
      ) : (
        <div
          data-testid="week-list"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'j2IntentFadeIn 250ms ease both',
          }}
        >
          {weekSessionsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{ color: TEXT_HINT, fontSize: 14, marginBottom: 12 }}>
                No sessions logged this week yet.
              </p>
              <button
                onClick={() => onLogTap()}
                className="text-sm font-semibold touch-manipulation"
                style={{
                  color: COPPER,
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '1px dashed rgba(196,145,95,0.5)',
                  backgroundColor: SURFACE_2,
                  transition: 'background-color 200ms ease',
                }}
              >
                + Log Mat Time
              </button>
            </div>
          ) : (
            <>
              {weekOffset === 0 && (sessionsByDate.get(toDateString(today)) ?? []).length === 0 && (
                <button
                  onClick={() => onLogTap()}
                  className="w-full text-left touch-manipulation"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderRadius: 14,
                    backgroundColor: SURFACE_2,
                    border: '1px dashed rgba(196,145,95,0.5)',
                    transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <span style={{ color: TEXT_TERTIARY, fontSize: 14 }}>
                    Today — {MONTH_NAMES[today.getMonth()]} {today.getDate()}
                  </span>
                  <span style={{ color: COPPER, fontSize: 14, fontWeight: 600 }}>
                    + Mat Time
                  </span>
                </button>
              )}
              {weekSessionsList.map(({ session, day, dayStr }) => {
                const isToday = dayStr === toDateString(today);
                const intensityColor = INTENSITY_COLOR[session.intensity] ?? '#CDDFA0';
                const giLabel = formatGiNogi(session.gi_nogi);
                const typeLabel = SESSION_TYPE_LABELS[session.session_type] ?? session.session_type;
                const primaryTag = session.tags?.[0]
                  ? (SKILL_TAGS.find(s => s.value === session.tags[0])?.label ?? session.tags[0])
                  : null;
                const title = primaryTag ? `${giLabel} ${typeLabel} — ${primaryTag}` : `${giLabel} ${typeLabel}`;

                return (
                  <button
                    key={session.id}
                    onClick={() => onSessionTap({ session, day, dayStr })}
                    className="w-full text-left touch-manipulation"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '16px 20px',
                      borderRadius: 14,
                      backgroundColor: CARD_BG,
                      border: isToday
                        ? '1px solid rgba(196,145,95,0.5)'
                        : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: WHISPER_BORDER,
                      transition: 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: intensityColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: TEXT_PRIMARY,
                          margin: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {title}
                      </p>
                      <p style={{ fontSize: 12, color: TEXT_TERTIARY, margin: '2px 0 0' }}>
                        {DAY_NAMES[day.getDay()]}, {MONTH_NAMES[day.getMonth()]} {day.getDate()}
                        {session.tags?.length > 1 && (
                          <>
                            <span style={{ margin: '0 5px', color: TEXT_DISABLED }}>·</span>
                            {SKILL_TAGS.find(s => s.value === session.tags[1])?.label ?? session.tags[1]}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: COPPER,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDuration(session.duration)}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
      </div>
    </>
  );
}
