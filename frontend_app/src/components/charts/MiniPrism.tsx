// Read-only mini Prism — 5-vertex pentagon that highlights a single pillar.
// Used by the desktop Journal detail view and (planned) the Intentions hero.
// For an interactive multi-vertex selection surface see `FocusAreaChips` +
// `PrismShape` (the post-Sprint-6 pattern). The legacy interactive `PillarPrism`
// was retired in the 2026-05-10 cleanup pass.

import { SKILL_TAGS } from '../../lib/constants.ts';
import { PALE_YELLOW, COPPER } from '../../lib/theme.ts';
import { SKILL_COLORS } from './RadarChart.tsx';

interface Props {
  /** Pillar value (skill-tag .value) to highlight. Pass null for a neutral pentagon. */
  activeTag?: string | null;
  /** SVG viewport size in px (width = height). Defaults to 240. */
  size?: number;
  /** Show pillar labels next to their vertices. Defaults to true. */
  showLabels?: boolean;
}

export default function MiniPrism({ activeTag = null, size = 240, showLabels = true }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.38;
  const N = SKILL_TAGS.length;

  const vs = SKILL_TAGS.map((tag, i) => {
    const angle = (2 * Math.PI / N) * i - Math.PI / 2;
    return {
      value: tag.value,
      label: tag.label,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      angle,
    };
  });
  const polyPoints = vs.map(v => `${v.x},${v.y}`).join(' ');
  const highlightColor = activeTag ? (SKILL_COLORS[activeTag]?.stroke ?? COPPER) : COPPER;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <radialGradient id={`mp-glow-${size}`} cx="50%" cy="50%">
          <stop offset="0%"   stopColor={PALE_YELLOW} stopOpacity="0.30" />
          <stop offset="50%"  stopColor={COPPER}      stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000"        stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow */}
      <circle cx={cx} cy={cy} r={R * 1.2} fill={`url(#mp-glow-${size})`} />

      {/* Concentric guide pentagons */}
      {[0.5, 0.85].map(t => (
        <polygon
          key={t}
          points={vs.map(v => `${cx + R * t * Math.cos(v.angle)},${cy + R * t * Math.sin(v.angle)}`).join(' ')}
          fill="none"
          stroke="rgba(196,145,95,0.18)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      ))}

      {/* Spokes */}
      {vs.map(v => (
        <line key={`spoke-${v.value}`} x1={cx} y1={cy} x2={v.x} y2={v.y} stroke="rgba(255,255,255,0.06)" />
      ))}

      {/* Main pentagon */}
      <polygon
        points={polyPoints}
        fill="rgba(196,145,95,0.04)"
        stroke="rgba(196,145,95,0.35)"
        strokeWidth={1.2}
      />

      {/* Highlight halo on active vertex */}
      {activeTag && (() => {
        const v = vs.find(x => x.value === activeTag);
        if (!v) return null;
        return (
          <circle cx={v.x} cy={v.y} r={size * 0.08} fill={highlightColor} opacity={0.25} />
        );
      })()}

      {/* Vertex dots */}
      {vs.map(v => {
        const isActive = v.value === activeTag;
        return (
          <g key={v.value}>
            <circle
              cx={v.x}
              cy={v.y}
              r={isActive ? 7 : 4}
              fill={isActive ? PALE_YELLOW : COPPER}
              style={isActive ? { filter: `drop-shadow(0 0 8px ${PALE_YELLOW})` } : undefined}
            />
            {showLabels && (() => {
              const dx = v.x - cx;
              const dy = v.y - cy;
              const textX = v.x + (dx > 1 ? 14 : dx < -1 ? -14 : 0);
              const textY = v.y + (dy > 1 ? 18 : dy < -1 ? -10 : 4);
              const anchor: 'start' | 'end' | 'middle' = dx > 1 ? 'start' : dx < -1 ? 'end' : 'middle';
              return (
                <text
                  x={textX}
                  y={textY}
                  textAnchor={anchor}
                  fill={isActive ? PALE_YELLOW : 'rgba(255,255,255,0.55)'}
                  fontSize={10}
                  fontWeight={isActive ? 700 : 600}
                  letterSpacing={1.6}
                  style={{ textTransform: 'uppercase' }}
                >
                  {v.label}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* Center mark */}
      <circle cx={cx} cy={cy} r={2.5} fill={PALE_YELLOW} opacity={0.6} />
    </svg>
  );
}
