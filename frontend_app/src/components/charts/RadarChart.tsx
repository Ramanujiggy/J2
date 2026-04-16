import { useRef, useEffect } from 'react';
import gsap from 'gsap';
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
  const centerPoints = SKILL_TAGS.map(() => `${CX},${CY}`).join(' ');
  const targetPoints = toPoints(dataPolygon);

  // Animation refs
  const strokeRef = useRef<SVGPolygonElement>(null);
  const fillRef   = useRef<SVGPolygonElement>(null);
  const ringRefs  = useRef<(SVGPolygonElement | null)[]>([]);
  const dotRefs   = useRef<(SVGGElement | null)[]>([]);
  const tlRef     = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    // Kill previous animation
    if (tlRef.current) tlRef.current.kill();

    const tl = gsap.timeline();
    tlRef.current = tl;

    // Grid rings pulse outward
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      tl.fromTo(ring,
        { opacity: 0, scale: 0.7, transformOrigin: `${CX}px ${CY}px` },
        { opacity: i === 3 ? 0.25 : 0.12, scale: 1, duration: 0.4, ease: 'power2.out' },
        i * 0.06,
      );
    });

    // Polygon draws from center
    if (strokeRef.current) {
      tl.fromTo(strokeRef.current,
        { attr: { points: centerPoints } },
        { attr: { points: targetPoints }, duration: 0.8, ease: 'power3.out' },
        0.15,
      );
    }
    if (fillRef.current) {
      tl.fromTo(fillRef.current,
        { attr: { points: centerPoints }, opacity: 0 },
        { attr: { points: targetPoints }, opacity: 1, duration: 0.8, ease: 'power3.out' },
        0.15,
      );
    }

    // Vertex dots pop in with stagger
    dotRefs.current.forEach((dot, i) => {
      if (!dot) return;
      tl.fromTo(dot,
        { scale: 0, transformOrigin: 'center center' },
        { scale: 1, duration: 0.35, ease: 'back.out(2.5)' },
        0.55 + i * 0.07,
      );
    });

    return () => { tl.kill(); };
  }, [normalized.join(',')]); // re-animate when data changes

  return (
    <svg viewBox="-20 -20 140 140" width="100%" aria-label="Skill radar chart">
      <defs>
        {/* Radial gradient for polygon fill — bright at center, fades outward */}
        <radialGradient id="prism-fill-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={polygonColors.stroke} stopOpacity="0.30" />
          <stop offset="100%" stopColor={polygonColors.stroke} stopOpacity="0.06" />
        </radialGradient>

        {/* Glow filter for polygon stroke */}
        <filter id="prism-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="-20" y="-20" width="140" height="140" fill={CARD_BG} rx="12" />

      {/* Grid rings — animated pulse on mount */}
      {gridRings.map((pts, ri) => (
        <polygon
          key={ri}
          ref={el => { ringRefs.current[ri] = el; }}
          points={toPoints(pts)}
          fill="none"
          stroke={PALE_YELLOW}
          strokeOpacity={ri === 3 ? 0.25 : 0.12}
          strokeWidth="0.5"
        />
      ))}

      {/* Spokes */}
      {SKILL_TAGS.map((_, i) => {
        const [x, y] = vertex(i, 1);
        return <line key={i} x1={CX} y1={CY} x2={x} y2={y}
          stroke={PALE_YELLOW} strokeOpacity="0.18" strokeWidth="0.5" />;
      })}

      {/* Fill polygon — radial gradient, animates from center */}
      <polygon
        ref={fillRef}
        points={centerPoints}
        fill="url(#prism-fill-grad)"
        strokeWidth={0}
      />

      {/* Stroke polygon — visible edge with glow filter */}
      <polygon
        ref={strokeRef}
        points={centerPoints}
        fill="none"
        stroke={polygonColors.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#prism-glow)"
      />

      {/* Vertex dots — larger with outer ring, animated pop-in */}
      {dataPolygon.map(([x, y], i) => normalized[i] > 0.02 && (
        <g key={i} ref={el => { dotRefs.current[i] = el; }}>
          <circle cx={x} cy={y} r="3.5" fill="none" stroke={polygonColors.dot} strokeWidth="0.8" opacity="0.3" />
          <circle cx={x} cy={y} r="1.8" fill={polygonColors.dot} />
        </g>
      ))}

      {/* Labels */}
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
