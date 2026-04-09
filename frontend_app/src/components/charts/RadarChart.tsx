import { SKILL_TAGS } from '../../lib/constants.ts';
import { PALE_YELLOW, CARD_BG } from '../../lib/theme.ts';

// ─── Pentagon math ────────────────────────────────────────────────────────────

const CX = 50;
const CY = 50;
const R  = 38;
const N  = SKILL_TAGS.length; // 5
const LABEL_R = R + 11;

function vertex(i: number, t: number): [number, number] {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  return [CX + R * t * Math.cos(angle), CY + R * t * Math.sin(angle)];
}

function toPoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function labelAttrs(i: number): {
  textAnchor: 'start' | 'end' | 'middle';
  dominantBaseline: 'auto' | 'hanging' | 'middle';
} {
  const angle = (2 * Math.PI / N) * i - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    textAnchor: cos > 0.15 ? 'start' : cos < -0.15 ? 'end' : 'middle',
    dominantBaseline: sin < -0.15 ? 'auto' : sin > 0.15 ? 'hanging' : 'middle',
  };
}

function labelLines(label: string): string[] {
  const i = label.indexOf(' ');
  return i !== -1 ? [label.slice(0, i), label.slice(i + 1)] : [label];
}

// ─── Skill colors — exported so SkillRadar can compute polygonColors ──────────

export const SKILL_COLORS: Record<string, { fill: string; stroke: string; dot: string }> = {
  standup:     { fill: 'rgba(212,160,64,0.25)',  stroke: 'rgba(212,160,64,0.85)',  dot: 'rgba(212,160,64,1.0)'  },
  guard:       { fill: 'rgba(82,181,108,0.25)',  stroke: 'rgba(82,181,108,0.85)',  dot: 'rgba(82,181,108,1.0)'  },
  submissions: { fill: 'rgba(218,100,80,0.25)',  stroke: 'rgba(218,100,80,0.85)',  dot: 'rgba(218,100,80,1.0)'  },
  pins:        { fill: 'rgba(196,145,95,0.25)',  stroke: 'rgba(196,145,95,0.85)',  dot: 'rgba(196,145,95,1.0)'  },
  passing:     { fill: 'rgba(90,175,210,0.25)',  stroke: 'rgba(90,175,210,0.85)',  dot: 'rgba(90,175,210,1.0)'  },
};
export const DEFAULT_COLORS = { fill: 'rgba(82,181,108,0.22)', stroke: 'rgba(176,214,100,0.75)', dot: 'rgba(176,214,100,0.9)' };

// ─── RadarChart ───────────────────────────────────────────────────────────────

interface RadarChartProps {
  normalized: number[];
  polygonColors: { fill: string; stroke: string; dot: string };
}

export default function RadarChart({ normalized, polygonColors }: RadarChartProps) {
  const gridRings    = [0.25, 0.5, 0.75, 1].map(t => SKILL_TAGS.map((_, i) => vertex(i, t)) as [number, number][]);
  const dataPolygon  = SKILL_TAGS.map((_, i) => vertex(i, Math.max(normalized[i], 0.02))) as [number, number][];

  return (
    <svg viewBox="-20 -20 140 140" width="100%" aria-label="Skill radar chart">
      <rect x="-20" y="-20" width="140" height="140" fill={CARD_BG} rx="12" />
      {gridRings.map((pts, ri) => (
        <polygon key={ri} points={toPoints(pts)} fill="none"
          stroke={PALE_YELLOW} strokeOpacity={ri === 3 ? 0.25 : 0.12} strokeWidth="0.5" />
      ))}
      {SKILL_TAGS.map((_, i) => {
        const [x, y] = vertex(i, 1);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y}
          stroke={PALE_YELLOW} strokeOpacity="0.18" strokeWidth="0.5" />;
      })}
      <polygon points={toPoints(dataPolygon)} fill={polygonColors.fill}
        stroke={polygonColors.stroke} strokeWidth="1" strokeLinejoin="round" />
      {dataPolygon.map(([x, y], i) => normalized[i] > 0.02 && (
        <circle key={i} cx={x} cy={y} r="1.5" fill={polygonColors.dot} />
      ))}
      {SKILL_TAGS.map(({ label }, i) => {
        const angle = (2 * Math.PI / N) * i - Math.PI / 2;
        const lx = CX + LABEL_R * Math.cos(angle);
        const ly = CY + LABEL_R * Math.sin(angle);
        const { textAnchor, dominantBaseline } = labelAttrs(i);
        const lines = labelLines(label);
        const yOffset = lines.length > 1 ? -3 : 0;
        return (
          <text key={i} x={lx.toFixed(2)} y={(ly + yOffset).toFixed(2)}
            textAnchor={textAnchor} dominantBaseline={dominantBaseline}
            fill={PALE_YELLOW} fontSize="5" fontWeight="700" fontFamily="sans-serif">
            {lines.map((line, li) => (
              <tspan key={li} x={lx.toFixed(2)} dy={li === 0 ? '0' : '6'}>{line}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
