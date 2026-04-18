import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { MONTH_NAMES } from '../../lib/constants.ts';

export interface WeekEntry { weekStart: Date; hours: number; count: number; isCurrent: boolean; }

export const BAR_W  = 12;
export const BAR_GAP = 4;

export default function WeeklyChart({ weeks }: { weeks: WeekEntry[] }) {
  const maxH = Math.max(...weeks.map(w => w.hours), 0.001);
  const barW = BAR_W, gap = BAR_GAP;
  const chartH = 78, baseY = 90;
  const contentW = weeks.length * (barW + gap) - gap;
  const W = contentW + 24;                   // 12px margin each side
  const H = 110;
  const offsetX = 12;

  const barRefs = useRef<(SVGRectElement | null)[]>([]);

  useEffect(() => {
    barRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const w = weeks[i];
      if (!w || w.hours <= 0) return;
      const targetH = Math.max((w.hours / maxH) * chartH, 3);
      gsap.fromTo(bar,
        { attr: { height: 1, y: baseY - 1 } },
        { attr: { height: targetH, y: baseY - targetH },
          duration: 0.55, delay: i * 0.018, ease: 'elastic.out(1, 0.85)' },
      );
    });
  }, [weeks.length, maxH]);

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
        const x = offsetX + i * (barW + gap);
        const color = w.isCurrent
          ? 'rgba(82,181,108,0.90)'
          : w.hours > 0
            ? 'rgba(82,181,108,0.55)'
            : 'rgba(255,255,255,0.07)';
        return (
          <rect
            key={i}
            ref={el => { barRefs.current[i] = el; }}
            x={x}
            y={baseY - 1}
            width={barW}
            height={1}
            rx={2}
            fill={color}
          />
        );
      })}
      {monthLabels.map(({ x, label }) => (
        <text key={label + x} x={x} y={104} fontSize={9} fill="rgba(242,228,168,0.35)">{label}</text>
      ))}
    </svg>
  );
}
