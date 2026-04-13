import { SURFACE_2, SURFACE_2_BORDER, COPPER } from '../lib/theme.ts';
import { formatDuration } from '../lib/sessionUtils.ts';

interface Props {
  streak: number;
  longestStreak: number;
  weekSessionCount: number;
  weekTotalMinutes: number;
  onTap?: () => void;
}

export default function StatStrip({ streak, longestStreak, weekSessionCount, weekTotalMinutes, onTap }: Props) {
  const isPersonalBest = streak > 0 && streak >= longestStreak;
  const cells: { label: string; value: string; sub?: string; accent?: string }[] = [
    {
      label: 'streak',
      value: streak > 0 ? `${streak}d` : '—',
      sub: isPersonalBest && streak > 1 ? 'personal best' : longestStreak > 0 ? `best: ${longestStreak}d` : undefined,
      accent: streak > 0 ? COPPER : undefined,
    },
    {
      label: weekSessionCount === 1 ? 'session' : 'sessions',
      value: String(weekSessionCount),
    },
    {
      label: 'this week',
      value: weekTotalMinutes > 0 ? formatDuration(weekTotalMinutes) : '0h',
    },
  ];

  return (
    <button
      onClick={onTap}
      className="w-full rounded-xl flex touch-manipulation"
      style={{
        backgroundColor: SURFACE_2,
        border: `1px solid ${SURFACE_2_BORDER}`,
        cursor: onTap ? 'pointer' : 'default',
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5"
          style={{
            borderRight: i < cells.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}
        >
          <span
            className="text-lg font-bold"
            style={{ color: cell.accent ?? 'rgba(255,255,255,0.88)' }}
          >
            {i === 0 && streak > 0 && (
              <span style={{ marginRight: 4, fontSize: 14 }}>🔥</span>
            )}
            {cell.value}
          </span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.38)' }}>
            {cell.label}
          </span>
          {cell.sub && (
            <span className="text-[10px]" style={{ color: isPersonalBest && i === 0 ? COPPER : 'rgba(255,255,255,0.22)' }}>
              {cell.sub}
            </span>
          )}
        </div>
      ))}
    </button>
  );
}
