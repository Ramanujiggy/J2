// PulseSparklineWidget — recent-rhythm card for the home page (Path Ahead).
// Replaces the cramped 5-column GitHub-style heatmap with a stat-led layout:
// big editorial readouts (sessions, weekly avg, current streak) above a quiet
// 30-day sparkline. The numbers lead; the sparkline supports.
//
// 30 days is too short for the heatmap format to read as "rhythm" (5 columns
// of weeks reads as a swatch, not a wave). At this window, a single-row
// sparkline plus aggregate stats communicates the same idea more directly.
//
// Tap anywhere → /calendar.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDateKey, buildDayMap, EMPTY_DAY } from './TrainingHeatmap.tsx';
import type { DayData } from './TrainingHeatmap.tsx';
import type { SessionSummary } from '../types/api.ts';
import { COPPER, PALE_YELLOW, INT_COLORS, TEXT_TERTIARY, TEXT_HINT } from '../lib/theme.ts';

const WINDOW_DAYS = 30;

interface PulseSparklineWidgetProps {
  sessions: SessionSummary[];
}

interface DaySlot {
  date: Date;
  key:  string;
  day:  DayData;
}

function buildLast30(dayMap: Map<string, DayData>): DaySlot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const slots: DaySlot[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDateKey(d);
    slots.push({ date: d, key, day: dayMap.get(key) ?? { ...EMPTY_DAY, notes: [] } });
  }
  return slots;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Bar color uses intensity bucket so a hard day reads warmer than a light one.
// Rest days get an empty placeholder dot rather than a zero-height bar so the
// strip never collapses to nothing.
function barColor(day: DayData): string {
  if (day.count === 0) return 'transparent';
  const i = Math.max(1, Math.min(5, day.maxIntensity)) as 1 | 2 | 3 | 4 | 5;
  return INT_COLORS[i];
}

export default function PulseSparklineWidget({ sessions }: PulseSparklineWidgetProps) {
  const navigate = useNavigate();

  const dayMap = useMemo(() => buildDayMap(sessions), [sessions]);
  const slots  = useMemo(() => buildLast30(dayMap), [dayMap]);

  // Window-scoped aggregates (last 30 days, not the calendar year).
  const sessionCount = useMemo(
    () => slots.reduce((acc, s) => acc + s.day.count, 0),
    [slots],
  );
  const windowMinutes = useMemo(
    () => slots.reduce((acc, s) => acc + s.day.totalMinutes, 0),
    [slots],
  );
  const weeklyAvg = useMemo(
    () => sessionCount * (7 / WINDOW_DAYS),
    [sessionCount],
  );
  const maxCount = useMemo(
    () => slots.reduce((m, s) => Math.max(m, s.day.count), 0),
    [slots],
  );

  // Empty / sparse — invitational copy instead of a flat sparkline.
  if (sessionCount < 5) {
    return (
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: 20,
          paddingBottom: 8,
        }}
      >
        <div className="j2-label-micro" style={{ marginBottom: 12 }}>
          Last 30 days · pulse
        </div>
        <p style={{ color: TEXT_TERTIARY, fontSize: 13.5, lineHeight: 1.5 }}>
          Log a few more sessions and your training rhythm will appear here.
        </p>
      </div>
    );
  }

  const firstDate = slots[0]!.date;
  const lastDate  = slots[slots.length - 1]!.date;

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        paddingTop: 20,
        paddingBottom: 8,
      }}
      onClick={() => navigate('/calendar')}
    >
      {/* ── Header row ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <span className="j2-label-micro" style={{ whiteSpace: 'nowrap' }}>
          Last 30 days · pulse
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COPPER,
            letterSpacing: '-0.1px',
          }}
        >
          View calendar →
        </span>
      </div>

      {/* ── Stat row ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 28,
          marginBottom: 22,
          flexWrap: 'wrap',
        }}
      >
        <Stat value={String(sessionCount)} label="sessions" />
        <Stat value={(windowMinutes / 60).toFixed(1)} suffix="h" label="hours" />
        <Stat value={weeklyAvg.toFixed(1)} suffix="/ wk" label="avg" />
      </div>

      {/* ── Sparkline ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          height: 38,
          marginBottom: 8,
          // Faint baseline rule under the bars
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: 1,
        }}
      >
        {slots.map((slot, i) => {
          const isToday   = i === slots.length - 1;
          const hasData   = slot.day.count > 0;
          // Bar height: 0 sessions → 4px stub, otherwise scale to the window's max.
          const heightPct = hasData
            ? Math.max(0.18, slot.day.count / Math.max(1, maxCount))
            : 0;
          return (
            <div
              key={slot.key}
              style={{
                flex: 1,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'stretch',
                position: 'relative',
              }}
              title={`${shortDate(slot.date)} · ${slot.day.count} session${slot.day.count === 1 ? '' : 's'}`}
            >
              {hasData ? (
                <div
                  style={{
                    height: `${heightPct * 100}%`,
                    minHeight: 4,
                    background: barColor(slot.day),
                    borderRadius: 2,
                    boxShadow: isToday
                      ? `0 0 6px ${barColor(slot.day)}80`
                      : `0 0 4px ${barColor(slot.day)}40`,
                    opacity: isToday ? 1 : 0.92,
                  }}
                />
              ) : (
                // Rest-day placeholder — small copper-tinted dot at the baseline,
                // so the strip reads as a continuous 30-day axis even on rest days.
                <div
                  style={{
                    height: 3,
                    background: 'rgba(196,145,95,0.22)',
                    borderRadius: 999,
                    margin: '0 1px',
                  }}
                />
              )}
              {isToday && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: COPPER,
                    boxShadow: `0 0 6px ${COPPER}`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Date axis ────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          fontWeight: 600,
          color: TEXT_HINT,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <span>{shortDate(firstDate)}</span>
        <span>{shortDate(lastDate)}</span>
      </div>
    </div>
  );
}

// ─── Local stat sub-component ─────────────────────────────────────────────────

function Stat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span
          className="j2-serif-display"
          style={{
            fontSize: 30,
            lineHeight: 1,
            color: PALE_YELLOW,
            fontWeight: 500,
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            style={{
              fontSize: 12,
              color: TEXT_TERTIARY,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <span
        style={{
          marginTop: 4,
          fontSize: 10,
          fontWeight: 600,
          color: TEXT_TERTIARY,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        {label}
      </span>
    </div>
  );
}
