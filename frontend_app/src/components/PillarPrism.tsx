import { useState, useRef } from 'react';
import { COPPER } from '../lib/theme.ts';
import { vibrate } from '../lib/haptics.ts';

// ── Pentagon geometry ─────────────────────────────────────────────────────
// viewBox 240×230, center (120,115), radius 88
// Vertices clockwise from top at -90° + i*72°

const CX = 120;
const CY = 115;
const R  = 88;

const PRISM_VERTICES = [
  { value: 'standup',     label: 'Stand-up',      shortLabel: 'Stand-up'  },
  { value: 'passing',     label: 'Guard Passing',  shortLabel: 'Passing'   },
  { value: 'pins',        label: 'Dynamic Pins',   shortLabel: 'Pins'      },
  { value: 'submissions', label: 'Submissions',    shortLabel: 'Subs'      },
  { value: 'guard',       label: 'Guard',          shortLabel: 'Guard'     },
] as const;

// Precompute vertex coordinates
const VERTICES = PRISM_VERTICES.map((v, i) => {
  const angle = ((-90 + i * 72) * Math.PI) / 180;
  return {
    ...v,
    cx: CX + R * Math.cos(angle),
    cy: CY + R * Math.sin(angle),
    // label anchor: push label further out from center
    lx: CX + (R + 22) * Math.cos(angle),
    ly: CY + (R + 22) * Math.sin(angle),
  };
});

const POLYGON_POINTS = VERTICES.map(v => `${v.cx.toFixed(1)},${v.cy.toFixed(1)}`).join(' ');

// Concentric guide rings — resonance distance rulers (vertex-count-agnostic)
const GUIDE_SCALES = [0.33, 0.55, 0.78];
const GUIDE_RINGS = GUIDE_SCALES.map(s =>
  VERTICES.map(v =>
    `${(CX + (v.cx - CX) * s).toFixed(1)},${(CY + (v.cy - CY) * s).toFixed(1)}`
  ).join(' ')
);

// Snap threshold — within this distance of a vertex, snap to 100%
const SNAP_THRESHOLD = R * 0.20;

// IDW weight calculation — returns 5 floats summing to 1.0
function calculateWeights(px: number, py: number): Record<string, number> {
  // Check for vertex snap — clean 100% selection
  for (const v of VERTICES) {
    if (Math.hypot(px - v.cx, py - v.cy) < SNAP_THRESHOLD) {
      const w: Record<string, number> = {};
      VERTICES.forEach(vv => { w[vv.value] = vv.value === v.value ? 1.0 : 0.0; });
      return w;
    }
  }
  // IDW distribution — p=2 sharpens focus near vertices
  const distances = VERTICES.map(v => Math.max(Math.hypot(px - v.cx, py - v.cy), 0.01));
  const rawWeights = distances.map(d => 1 / (d * d));
  const total = rawWeights.reduce((a, b) => a + b, 0);
  const w: Record<string, number> = {};
  VERTICES.forEach((v, i) => { w[v.value] = rawWeights[i] / total; });
  return w;
}

// Map resonance score → visual opacity on the dashed line
function resonanceToOpacity(r: number): number {
  return 0.25 + (r / 10) * 0.55;
}

interface Props {
  heading: string | null;
  resonance: number | null;
  /** Called with nearest vertex value, computed resonance, and IDW pillar weights */
  onSelect: (heading: string, resonance: number, weights: Record<string, number>) => void;
  /** If provided, places the dot at this vertex at full resonance (roulette pre-fill) */
  defaultHeading?: string;
  /** When true, always snap to nearest vertex (no distribution mode). Used for intention setting. */
  snapOnly?: boolean;
}

export default function PillarPrism({ heading, resonance, onSelect, defaultHeading, snapOnly }: Props) {
  // Dot position in SVG coordinate space
  const [dotPos, setDotPos] = useState<{ x: number; y: number } | null>(() => {
    if (!defaultHeading) return null;
    const v = VERTICES.find(v => v.value === defaultHeading);
    return v ? { x: v.cx, y: v.cy } : null;
  });

  const [weights, setWeights] = useState<Record<string, number> | null>(() => {
    if (!defaultHeading) return null;
    const w: Record<string, number> = {};
    VERTICES.forEach(v => { w[v.value] = v.value === defaultHeading ? 1.0 : 0.0; });
    return w;
  });
  const [isSnapped, setIsSnapped] = useState(!!defaultHeading);

  const activeVertex = VERTICES.find(v => v.value === heading) ?? null;
  const prevNearestRef = useRef<string | null>(heading);
  const prevResRef = useRef<number | null>(resonance);
  const [pressing, setPressing] = useState(false);

  function svgCoords(e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (240 / rect.width),
      y: (e.clientY - rect.top)  * (230 / rect.height),
    };
  }

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    e.preventDefault();
    const { x, y } = svgCoords(e);

    let nearest = VERTICES[0]!;
    let minDist = Infinity;
    for (const v of VERTICES) {
      const d = Math.hypot(x - v.cx, y - v.cy);
      if (d < minDist) { minDist = d; nearest = v; }
    }

    // Clamp dot to inside the pentagon's bounding radius
    const distFromCenter = Math.hypot(x - CX, y - CY);
    const clampRatio = distFromCenter > R ? R / distFromCenter : 1;
    const clampedX = CX + (x - CX) * clampRatio;
    const clampedY = CY + (y - CY) * clampRatio;

    const dNorm = Math.min(1, minDist / R);
    const res = Math.max(2, 10 - Math.round(dNorm * 8));

    // Haptic feedback + press state
    if (e.type === 'pointerdown') { vibrate(8); setPressing(true); }
    if (nearest.value !== prevNearestRef.current) {
      vibrate(12); // vertex snap
      prevNearestRef.current = nearest.value;
    } else if (res !== prevResRef.current) {
      vibrate(6);  // resonance tick
    }
    prevResRef.current = res;

    const w = snapOnly
      ? (() => { const ww: Record<string, number> = {}; VERTICES.forEach(v => { ww[v.value] = v.value === nearest.value ? 1.0 : 0.0; }); return ww; })()
      : calculateWeights(clampedX, clampedY);
    const snapped = snapOnly || Object.values(w).some(v => v === 1.0);
    setWeights(w);
    setIsSnapped(snapped);
    setDotPos(snapOnly ? { x: nearest.cx, y: nearest.cy } : { x: clampedX, y: clampedY });
    onSelect(nearest.value, res, w);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg
        viewBox="0 0 240 230"
        style={{
          width: '100%',
          maxWidth: 280,
          touchAction: 'none',
          cursor: 'crosshair',
          userSelect: 'none',
        }}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        onPointerUp={() => setPressing(false)}
        onPointerLeave={() => setPressing(false)}
      >
        {/* Spoke lines — center to each vertex */}
        {VERTICES.map(v => (
          <line
            key={v.value + '-spoke'}
            x1={CX} y1={CY}
            x2={v.cx} y2={v.cy}
            stroke={heading === v.value ? 'rgba(196,145,95,0.22)' : 'rgba(196,145,95,0.09)'}
            strokeWidth={1}
          />
        ))}

        {/* Concentric guide rings — resonance distance rulers */}
        {GUIDE_RINGS.map((pts, i) => (
          <polygon
            key={`guide-${i}`}
            points={pts}
            fill="none"
            stroke={`rgba(196,145,95,${0.04 + i * 0.02})`}
            strokeWidth={0.5}
          />
        ))}

        {/* Radial gradient def — emanates from active vertex */}
        {activeVertex && (
          <defs>
            <radialGradient
              id="prism-glow"
              gradientUnits="userSpaceOnUse"
              cx={activeVertex.cx}
              cy={activeVertex.cy}
              r={R * 1.2}
            >
              <stop offset="0%" stopColor="rgba(196,145,95,0.12)" />
              <stop offset="100%" stopColor="rgba(196,145,95,0)" />
            </radialGradient>
          </defs>
        )}

        {/* Pentagon — base fill + gradient overlay */}
        <polygon
          points={POLYGON_POINTS}
          fill="rgba(21,46,34,0.85)"
        />
        <polygon
          points={POLYGON_POINTS}
          fill={activeVertex ? 'url(#prism-glow)' : 'none'}
          stroke="rgba(196,145,95,0.22)"
          strokeWidth={1.5}
        />

        {/* Dashed connections — dot to every vertex. Primary is brightest,
            others glow softly to signal they're live (future: tap to mute). */}
        {dotPos && VERTICES.map(v => {
          const isPrimary = heading === v.value;
          const primaryOpacity = resonance ? resonanceToOpacity(resonance) : 0.3;
          return (
            <line
              key={v.value + '-dash'}
              x1={dotPos.x} y1={dotPos.y}
              x2={v.cx} y2={v.cy}
              stroke={COPPER}
              strokeWidth={isPrimary ? 1.2 : 0.8}
              strokeDasharray={isPrimary ? '3 3' : '2 3'}
              opacity={isPrimary ? primaryOpacity : 0.28}
              style={{
                filter: isPrimary
                  ? 'drop-shadow(0 0 2.5px rgba(196,145,95,0.45))'
                  : 'drop-shadow(0 0 2px rgba(196,145,95,0.25))',
                transition: 'opacity 0.25s ease, stroke-width 0.25s ease',
              }}
            />
          );
        })}

        {/* Vertex glow ring — pulsing copper halo only on the primary vertex */}
        {activeVertex && (
          <circle
            key={activeVertex.value + '-ring'}
            cx={activeVertex.cx}
            cy={activeVertex.cy}
            r={13}
            fill="rgba(196,145,95,0.18)"
            stroke={COPPER}
            strokeWidth={1.5}
            style={{ animation: 'j2IntentCopperPulse 4.5s ease-in-out infinite' }}
          />
        )}

        {/* Placed dot — scales on press */}
        {dotPos && (
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r={7}
            fill={COPPER}
            style={{
              filter: 'drop-shadow(0 0 5px rgba(196,145,95,0.65))',
              transform: pressing ? 'scale(0.92)' : 'scale(1)',
              transformOrigin: `${dotPos.x}px ${dotPos.y}px`,
              transition: pressing
                ? 'transform 0.08s ease-in'
                : 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        )}

        {/* Vertex labels */}
        {VERTICES.map(v => {
          const isActive = heading === v.value;
          // Nudge top/bottom labels for readability
          const dyOffset = v.cy < CY - 20 ? -6 : v.cy > CY + 20 ? 14 : 4;
          return (
            <text
              key={v.value + '-label'}
              x={v.lx}
              y={v.ly + dyOffset}
              textAnchor="middle"
              fontSize={isActive ? 10.5 : 9.5}
              fontWeight={isActive ? 600 : 400}
              fill={isActive ? COPPER : 'rgba(255,255,255,0.42)'}
              style={{ transition: 'fill 0.2s, font-size 0.2s', pointerEvents: 'none' }}
            >
              {v.shortLabel}
            </text>
          );
        })}

        {/* Weight percentages — only shown in distribution mode (not snapped to vertex) */}
        {weights && !isSnapped && VERTICES.map(v => {
          const pct = Math.round((weights[v.value] ?? 0) * 100);
          if (pct < 3) return null;
          const above = v.cy < CY;
          return (
            <text
              key={v.value + '-pct'}
              x={v.cx}
              y={v.cy + (above ? -18 : 22)}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill={pct > 40 ? COPPER : 'rgba(255,255,255,0.35)'}
              style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
            >
              {pct}%
            </text>
          );
        })}
      </svg>

      {/* Hint */}
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 1.4 }}>
        {heading
          ? isSnapped
            ? (() => {
                const label = PRISM_VERTICES.find(v => v.value === heading)?.label ?? heading;
                const desc = resonance == null ? '' :
                  resonance >= 10 ? '· focused' :
                  resonance >= 8  ? '· targeted' :
                  resonance >= 6  ? '· solid' :
                  resonance >= 4  ? '· mixed' : '· exploratory';
                return `${label} ${desc}`;
              })()
            : (() => {
                const sorted = Object.entries(weights ?? {}).sort((a, b) => b[1] - a[1]);
                const top = sorted[0];
                const second = sorted[1];
                if (!top) return '';
                const topLabel = PRISM_VERTICES.find(v => v.value === top[0])?.label ?? top[0];
                if (!second || second[1] < 0.15) return topLabel;
                const secondLabel = PRISM_VERTICES.find(v => v.value === second[0])?.shortLabel ?? second[0];
                return `${topLabel} · ${secondLabel}`;
              })()
          : 'Tap or drag to mark your training focus'}
      </p>
    </div>
  );
}
