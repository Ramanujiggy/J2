import { MONTH_NAMES } from '../../lib/constants.ts';
import { CARD_BG, PALE_YELLOW } from '../../lib/theme.ts';
import type { SessionSummary } from '../TrainingHeatmap.tsx';

export function sessionMonth(raw: unknown): number {
  if (raw instanceof Date) return raw.getMonth();
  const str = String(raw);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? parseInt(match[2], 10) - 1 : NaN;
}

export default function VolumeChart({ sessions }: { sessions: SessionSummary[] }) {
  const monthlyHours = Array(12).fill(0) as number[];
  for (const s of sessions) {
    const m = sessionMonth(s.date);
    if (isNaN(m)) continue;
    monthlyHours[m] += s.duration / 60;
  }
  const maxH = Math.max(...monthlyHours, 0.001);
  const currentMonth = new Date().getMonth();
  const barW = 10;
  const betweenGap = (140 - 8 - 12 * barW) / 11;
  const chartH = 72;
  const baseY  = 84;

  return (
    <svg viewBox="0 0 140 100" width="100%" aria-label="Monthly training volume">
      <rect x="0" y="0" width="140" height="100" fill={CARD_BG} rx="12" />
      {monthlyHours.map((h, m) => {
        const barH = Math.max((h / maxH) * chartH, h > 0 ? 2 : 0);
        const x = 4 + m * (barW + betweenGap);
        const isCurrent = m === currentMonth;
        const fill = isCurrent ? 'rgba(82,181,108,0.90)' : 'rgba(82,181,108,0.45)';
        return (
          <g key={m}>
            {h > 0
              ? <rect x={x} y={baseY - barH} width={barW} height={barH} rx="1.5" fill={fill}>
                  <title>{`${MONTH_NAMES[m]}: ${h.toFixed(1)}h`}</title>
                </rect>
              : <rect x={x} y={baseY - 1}    width={barW} height={1}    rx="0.5" fill="rgba(255,255,255,0.07)">
                  <title>{`${MONTH_NAMES[m]}: no sessions`}</title>
                </rect>
            }
            <text x={x + barW / 2} y={94} textAnchor="middle"
              fill={isCurrent ? PALE_YELLOW : 'rgba(242,228,168,0.25)'}
              fontSize="4.5" fontFamily="sans-serif">
              {MONTH_NAMES[m].slice(0, 1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
