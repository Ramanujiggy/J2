// DayRail — horizontal Mon-Sun completion rail for the current week.
// Tappable: done days open the session detail, today (if empty) opens the log.

import { COPPER, PALE_YELLOW } from '../lib/theme.ts';

export interface DayRailDay {
  dow: string;
  date: number;
  state: 'done' | 'today' | 'rest' | 'future';
}

interface DayRailProps {
  days: DayRailDay[];
  onDayTap?: (index: number) => void;
}

const ORANGE = '#DA7422';
const SIZE = 34;
const R = SIZE / 2;
const CR = R - 1.5;

export default function DayRail({ days, onDayTap }: DayRailProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {days.map((day, i) => {
        const isDone = day.state === 'done';
        const isToday = day.state === 'today';
        const isFaint = day.state === 'rest' || day.state === 'future';
        const tappable = isDone || isToday;

        const ringColor = isDone
          ? COPPER
          : isToday
            ? ORANGE
            : 'rgba(255,255,255,0.12)';
        const ringWidth = isFaint ? 1.5 : 2.5;

        const dowColor = isToday
          ? PALE_YELLOW
          : 'rgba(255,255,255,0.38)';

        const dateColor = isToday
          ? ORANGE
          : 'rgba(255,255,255,0.28)';

        const content = (
          <>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: dowColor,
                textTransform: 'uppercase' as const,
              }}
            >
              {day.dow}
            </span>
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
          </>
        );

        if (tappable && onDayTap) {
          return (
            <button
              key={i}
              onClick={() => onDayTap(i)}
              className="touch-manipulation"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 7,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              {content}
            </button>
          );
        }

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
            {content}
          </div>
        );
      })}
    </div>
  );
}
