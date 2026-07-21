// DayRail — horizontal Mon-Sun completion rail for the current week.
// Glanceable, non-interactive. Shows done/today/rest/future states.

import { COPPER, PALE_YELLOW } from '../lib/theme.ts';

interface DayRailProps {
  days: Array<{
    dow: string;       // 'Mon', 'Tue', etc.
    date: number;      // day of month
    state: 'done' | 'today' | 'rest' | 'future';
  }>;
}

const ORANGE = '#DA7422';
const SIZE = 34;
const R = SIZE / 2;
const CR = R - 1.5; // circle radius inset so stroke sits inside

export default function DayRail({ days }: DayRailProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {days.map((day, i) => {
        const isDone = day.state === 'done';
        const isToday = day.state === 'today';
        const isFaint = day.state === 'rest' || day.state === 'future';

        // Ring style per state
        const ringColor = isDone
          ? COPPER
          : isToday
            ? ORANGE
            : 'rgba(255,255,255,0.12)';
        const ringWidth = isFaint ? 1.5 : 2.5;

        // Dow label color
        const dowColor = isToday
          ? PALE_YELLOW
          : 'rgba(255,255,255,0.38)';

        // Date number color (only shown for non-done states)
        const dateColor = isToday
          ? ORANGE
          : 'rgba(255,255,255,0.28)';

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 7,
            }}
          >
            {/* Day-of-week label */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: dowColor,
                textTransform: 'uppercase',
              }}
            >
              {day.dow}
            </span>

            {/* Circle with ring + content */}
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ display: 'block' }}
            >
              <circle
                cx={R}
                cy={R}
                r={CR}
                fill="none"
                stroke={ringColor}
                strokeWidth={ringWidth}
              />
              {isDone ? (
                // Checkmark centered in circle
                <g transform={`translate(${R - 6}, ${R - 5.5})`}>
                  <polyline
                    points="1.5,5.5 5,9 11,2"
                    fill="none"
                    stroke={PALE_YELLOW}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ) : (
                // Date number centered in circle
                <text
                  x={R}
                  y={R}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={dateColor}
                  fontSize={12}
                  fontWeight={isToday ? 700 : 500}
                >
                  {day.date}
                </text>
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
