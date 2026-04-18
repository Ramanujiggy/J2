import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { PALE_YELLOW, GLOW_SOFT } from '../../lib/theme.ts';

export interface DonutSegment { value: number; color: string; label: string; }

function describeArc(cx: number, cy: number, rOut: number, rIn: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(startDeg), e = toRad(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const cos = Math.cos, sin = Math.sin;
  return [
    `M ${(cx + rOut * cos(s)).toFixed(3)} ${(cy + rOut * sin(s)).toFixed(3)}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${(cx + rOut * cos(e)).toFixed(3)} ${(cy + rOut * sin(e)).toFixed(3)}`,
    `L ${(cx + rIn  * cos(e)).toFixed(3)} ${(cy + rIn  * sin(e)).toFixed(3)}`,
    `A ${rIn}  ${rIn}  0 ${large} 0 ${(cx + rIn  * cos(s)).toFixed(3)} ${(cy + rIn  * sin(s)).toFixed(3)}`,
    'Z',
  ].join(' ');
}

export default function DonutChart({ segments, centerLabel, centerSub }: {
  segments: DonutSegment[];
  centerLabel: string;
  centerSub: string;
}) {
  const nonZero = segments.filter(s => s.value > 0);
  const total   = nonZero.reduce((a, s) => a + s.value, 0);
  const arcRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    arcRefs.current.forEach((arc, i) => {
      if (!arc) return;
      const len = arc.getTotalLength();
      gsap.fromTo(arc,
        { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 },
        { strokeDashoffset: 0, fillOpacity: 0.88,
          duration: 0.85, delay: i * 0.15, ease: 'power2.inOut' },
      );
    });
  }, [total, nonZero.length]);

  if (total === 0) {
    return (
      <svg viewBox="0 0 100 100" width="100%" aria-label="No data">
        <circle cx={50} cy={50} r={31.5} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={17} />
        <text x={50} y={50} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.2)" fontSize={6} fontFamily="sans-serif">No data</text>
      </svg>
    );
  }

  const CX = 50, CY = 50, R_OUT = 40, R_IN = 23;
  const GAP_DEG = nonZero.length > 1 ? 3 : 0;
  const availDeg = 360 - GAP_DEG * nonZero.length;

  let angle = -90;
  const arcs = nonZero.map(seg => {
    const sweep = (seg.value / total) * availDeg;
    const path  = describeArc(CX, CY, R_OUT, R_IN, angle, angle + sweep);
    angle += sweep + GAP_DEG;
    return { ...seg, path };
  });

  return (
    <svg viewBox="0 0 100 100" width="100%" aria-label="Donut chart">
      {arcs.map((seg, i) => (
        <path
          key={i}
          ref={el => { arcRefs.current[i] = el; }}
          d={seg.path}
          fill={seg.color}
          fillOpacity={0}
          stroke={seg.color}
          strokeWidth={0.5}
        />
      ))}
      <text x={CX} y={CY - 5} textAnchor="middle" dominantBaseline="auto"
        fill={PALE_YELLOW} fontSize={14} fontWeight={700} fontFamily="sans-serif"
        style={{ textShadow: GLOW_SOFT }}>
        {centerLabel}
      </text>
      <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="auto"
        fill="rgba(255,255,255,0.35)" fontSize={6} fontFamily="sans-serif">
        {centerSub}
      </text>
    </svg>
  );
}
