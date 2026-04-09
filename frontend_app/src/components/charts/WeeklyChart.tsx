import { MONTH_NAMES } from '../../lib/constants.ts';

export interface WeekEntry { weekStart: Date; hours: number; count: number; isCurrent: boolean; }

export default function WeeklyChart({ weeks }: { weeks: WeekEntry[] }) {
  const maxH = Math.max(...weeks.map(w => w.hours), 0.001);
  const barW = 8, gap = 3;
  const chartH = 78, baseY = 90;
  const contentW = 52 * (barW + gap) - gap; // 569
  const W = contentW + 24;                   // 593, 12px margin each side
  const H = 110;
  const offsetX = 12;

  const monthLabels: { x: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((w, i) => {
    const m = w.weekStart.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ x: offsetX + i * (barW + gap), label: MONTH_NAMES[m] });
      lastMonth = m;
    }
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} aria-label="Weekly training volume">
      {weeks.map((w, i) => {
        const barH = Math.max((w.hours / maxH) * chartH, w.hours > 0 ? 3 : 0);
        const x = offsetX + i * (barW + gap);
        const color = w.isCurrent
          ? 'rgba(82,181,108,0.90)'
          : w.hours > 0
            ? 'rgba(82,181,108,0.55)'
            : 'rgba(255,255,255,0.07)';
        return (
          <rect key={i} x={x} y={baseY - barH} width={barW} height={Math.max(barH, 1)} rx={2} fill={color}>
            <title>{w.hours > 0
              ? `${w.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.hours.toFixed(1)}h (${w.count} session${w.count !== 1 ? 's' : ''})`
              : 'No sessions'}</title>
          </rect>
        );
      })}
      {monthLabels.map(({ x, label }) => (
        <text key={label + x} x={x} y={104} fontSize={9} fill="rgba(242,228,168,0.35)">{label}</text>
      ))}
    </svg>
  );
}
