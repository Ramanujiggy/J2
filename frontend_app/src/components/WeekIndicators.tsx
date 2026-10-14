import type { SessionSummary } from '../types/api.ts';
import { COPPER, TEXT_PRIMARY } from '../lib/theme.ts';
import { toDateString, INTENSITY_COLOR, formatDuration } from '../lib/sessionUtils.ts';

interface Props {
  weekDays: Date[];
  today: Date;
  sessionsByDate: Map<string, SessionSummary[]>;
  onDayTap: (day: Date, sessions: SessionSummary[]) => void;
  onLogTap: (day: Date) => void;
}

const DAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function WeekIndicators({
  weekDays,
  today,
  sessionsByDate,
  onDayTap,
  onLogTap,
}: Props) {
  const todayStr = toDateString(today);

  return (
    <div className="flex justify-between px-1">
      {weekDays.map((day) => {
        const dayStr = toDateString(day);
        const daySessions = sessionsByDate.get(dayStr) ?? [];
        const isToday = dayStr === todayStr;
        const isPast = dayStr < todayStr;
        const isFuture = dayStr > todayStr;
        const hasSessions = daySessions.length > 0;

        // Highest intensity session determines the fill color
        const maxIntensity = hasSessions
          ? Math.max(...daySessions.map(s => Number(s.intensity)))
          : 0;
        const fillColor = hasSessions
          ? (INTENSITY_COLOR[maxIntensity] ?? '#CDDFA0')
          : undefined;

        const totalMinutes = daySessions.reduce((sum, s) => sum + Number(s.duration), 0);

        const size = isToday ? 46 : 40;

        return (
          <button
            key={dayStr}
            onClick={() => {
              if (hasSessions) {
                onDayTap(day, daySessions);
              } else {
                onLogTap(day);
              }
            }}
            className="flex flex-col items-center gap-1 touch-manipulation"
            style={{ minWidth: size }}
          >
            {/* Day abbreviation */}
            <span
              className="text-[10px] font-medium uppercase"
              style={{
                color: isToday
                  ? 'rgba(255,255,255,0.60)'
                  : hasSessions
                    ? 'rgba(255,255,255,0.45)'
                    : 'rgba(255,255,255,0.25)',
              }}
            >
              {DAY_ABBR[day.getDay()]}
            </span>

            {/* Circle indicator */}
            <div
              className="flex items-center justify-center rounded-full transition-all"
              style={{
                width: size,
                height: size,
                backgroundColor: hasSessions
                  ? fillColor
                  : isToday
                    ? 'rgba(196,145,95,0.08)'
                    : isFuture
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(255,255,255,0.04)',
                border: isToday
                  ? `2px solid ${COPPER}`
                  : hasSessions
                    ? '2px solid transparent'
                    : isFuture
                      ? '1px solid rgba(255,255,255,0.04)'
                      : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isToday
                  ? '0 0 12px rgba(196,145,95,0.25)'
                  : undefined,
                animation: isToday && !hasSessions
                  ? 'j2-today-pulse 4s ease-in-out infinite'
                  : undefined,
              }}
            >
              {isToday && !hasSessions ? (
                <span className="text-base font-semibold" style={{ color: COPPER }}>+</span>
              ) : hasSessions ? (
                <span
                  className="text-sm font-bold"
                  style={{ color: TEXT_PRIMARY }}
                >
                  {day.getDate()}
                </span>
              ) : (
                <span
                  className="text-sm"
                  style={{ color: isPast ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)' }}
                >
                  {day.getDate()}
                </span>
              )}
            </div>

            {/* Duration below */}
            <span
              className="text-[10px]"
              style={{
                color: hasSessions ? 'rgba(255,255,255,0.45)' : 'transparent',
                minHeight: 14,
              }}
            >
              {hasSessions ? formatDuration(totalMinutes) : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
