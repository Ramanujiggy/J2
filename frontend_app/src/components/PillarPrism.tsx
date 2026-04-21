import { useState, useRef, useEffect } from 'react';
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

type Vertex = typeof VERTICES[number];

// Snap threshold — within this distance of a vertex, snap to 100%
const SNAP_THRESHOLD = R * 0.20;

// Tap-to-toggle tuning
// Tapping within this radius of a vertex + releasing with little movement
// toggles that vertex's muted state (no dot placement for that gesture).
const VERTEX_TAP_RADIUS = 14;       // SVG-coord px (≈ finger-size at mobile scale)
const TAP_MOVE_THRESHOLD = 4;       // movement above this commits to drag mode
const TAP_MAX_DURATION_MS = 400;    // longer than this is a hold, not a tap

// IDW weight calculation — returns floats summing to 1.0 across only the active vertices.
// Muted pillars are absent from the returned dict entirely (not zero-keyed).
function calculateWeights(
  px: number,
  py: number,
  active: readonly Vertex[],
): Record<string, number> {
  if (active.length === 0) return {};
  if (active.length === 1) return { [active[0]!.value]: 1.0 };

  // Check for vertex snap — clean 100% selection
  for (const v of active) {
    if (Math.hypot(px - v.cx, py - v.cy) < SNAP_THRESHOLD) {
      const w: Record<string, number> = {};
      active.forEach(vv => { w[vv.value] = vv.value === v.value ? 1.0 : 0.0; });
      return w;
    }
  }
  // IDW distribution — p=2 sharpens focus near vertices
  const distances = active.map(v => Math.max(Math.hypot(px - v.cx, py - v.cy), 0.01));
  const rawWeights = distances.map(d => 1 / (d * d));
  const total = rawWeights.reduce((a, b) => a + b, 0);
  const w: Record<string, number> = {};
  active.forEach((v, i) => { w[v.value] = rawWeights[i] / total; });
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
  const [mutedVertices, setMutedVertices] = useState<Set<string>>(new Set());

  const activeVertex = VERTICES.find(v => v.value === heading) ?? null;
  const activeVertices = VERTICES.filter(v => !mutedVertices.has(v.value));

  const prevNearestRef = useRef<string | null>(heading);
  const prevResRef = useRef<number | null>(resonance);
  const [pressing, setPressing] = useState(false);

  // Tap-to-toggle plumbing — tracks an in-flight gesture's origin so we can
  // tell a quick vertex-tap (toggle mute) from a drag (place dot).
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    candidateVertex: Vertex | null;  // set iff pointerdown landed within VERTEX_TAP_RADIUS
  } | null>(null);

  function svgCoords(e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (240 / rect.width),
      y: (e.clientY - rect.top)  * (230 / rect.height),
    };
  }

  function findTapVertex(x: number, y: number): Vertex | null {
    for (const v of VERTICES) {
      if (Math.hypot(x - v.cx, y - v.cy) < VERTEX_TAP_RADIUS) return v;
    }
    return null;
  }

  function tryToggleMute(value: string) {
    // Can't mute the currently active heading — user must reselect elsewhere first
    if (heading === value) { vibrate(4); return; }
    // Can't mute down to zero active vertices
    const willBeMuted = !mutedVertices.has(value);
    if (willBeMuted && activeVertices.length <= 1) { vibrate(4); return; }
    vibrate(60); // distinct long pulse — categorically different from the 6/8/12ms ticks
    setMutedVertices(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  }

  function placeDot(x: number, y: number, isFirstEvent: boolean) {
    if (activeVertices.length === 0) return;

    // Nearest active vertex — drives heading + resonance
    let nearest = activeVertices[0]!;
    let minDist = Infinity;
    for (const v of activeVertices) {
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

    if (isFirstEvent) { vibrate(8); setPressing(true); }
    if (nearest.value !== prevNearestRef.current) {
      vibrate(12);
      prevNearestRef.current = nearest.value;
    } else if (res !== prevResRef.current) {
      vibrate(6);
    }
    prevResRef.current = res;

    const w = snapOnly
      ? (() => { const ww: Record<string, number> = {}; activeVertices.forEach(v => { ww[v.value] = v.value === nearest.value ? 1.0 : 0.0; }); return ww; })()
      : calculateWeights(clampedX, clampedY, activeVertices);
    const snapped = snapOnly || Object.values(w).some(v => v === 1.0);
    setWeights(w);
    setIsSnapped(snapped);
    setDotPos(snapOnly ? { x: nearest.cx, y: nearest.cy } : { x: clampedX, y: clampedY });
    onSelect(nearest.value, res, w);
  }

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    e.preventDefault();
    const { x, y } = svgCoords(e);

    if (e.type === 'pointerdown') {
      // Is this press landing on a vertex dot's hitbox? If so, defer placement —
      // we'll decide tap-vs-drag on pointerup/move.
      const candidate = findTapVertex(x, y);
      gestureRef.current = { startX: x, startY: y, startTime: Date.now(), candidateVertex: candidate };
      if (candidate) {
        // Started on a vertex tap target — wait to see if they drag away
        setPressing(true);
        return;
      }
      // Not on a vertex — place dot immediately (existing behavior)
      placeDot(x, y, true);
      return;
    }

    if (e.type === 'pointermove') {
      const g = gestureRef.current;
      if (!g) return;
      const dx = x - g.startX;
      const dy = y - g.startY;
      const moved = dx * dx + dy * dy > TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD;
      if (g.candidateVertex && moved) {
        // Committed to drag — revoke toggle candidacy, place dot from here on
        g.candidateVertex = null;
      }
      if (!g.candidateVertex) placeDot(x, y, false);
      return;
    }

    // pointerup / pointercancel: if still a tap candidate + quick, toggle mute
    if (e.type === 'pointerup') {
      const g = gestureRef.current;
      if (g && g.candidateVertex) {
        const duration = Date.now() - g.startTime;
        if (duration < TAP_MAX_DURATION_MS) {
          tryToggleMute(g.candidateVertex.value);
        }
      }
      gestureRef.current = null;
    }
  }

  // When mute state changes, recompute weights using the existing dot position.
  // Without this, a muted vertex would still contribute to the last-saved weights
  // until the user gestures again.
  useEffect(() => {
    if (!dotPos) return;
    if (activeVertices.length === 0) return;

    let nearest = activeVertices[0]!;
    let minDist = Infinity;
    for (const v of activeVertices) {
      const d = Math.hypot(dotPos.x - v.cx, dotPos.y - v.cy);
      if (d < minDist) { minDist = d; nearest = v; }
    }

    const dNorm = Math.min(1, minDist / R);
    const res = Math.max(2, 10 - Math.round(dNorm * 8));

    const w = snapOnly
      ? (() => { const ww: Record<string, number> = {}; activeVertices.forEach(v => { ww[v.value] = v.value === nearest.value ? 1.0 : 0.0; }); return ww; })()
      : calculateWeights(dotPos.x, dotPos.y, activeVertices);
    setWeights(w);
    setIsSnapped(snapOnly || Object.values(w).some(v => v === 1.0));
    onSelect(nearest.value, res, w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutedVertices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg
        data-testid="pillar-prism"
        viewBox="0 -16 240 246"
        style={{
          width: '100%',
          maxWidth: 280,
          touchAction: 'none',
          cursor: 'crosshair',
          userSelect: 'none',
          overflow: 'visible',
        }}
        onPointerDown={handlePointer}
        onPointerMove={handlePointer}
        onPointerUp={(e) => { handlePointer(e); setPressing(false); }}
        onPointerLeave={() => { gestureRef.current = null; setPressing(false); }}
      >
        {/* Spoke lines — center to each vertex */}
        {VERTICES.map(v => {
          const isMuted = mutedVertices.has(v.value);
          const stroke = isMuted
            ? 'rgba(196,145,95,0.03)'
            : heading === v.value
              ? 'rgba(196,145,95,0.22)'
              : 'rgba(196,145,95,0.09)';
          return (
            <line
              key={v.value + '-spoke'}
              x1={CX} y1={CY}
              x2={v.cx} y2={v.cy}
              stroke={stroke}
              strokeWidth={1}
            />
          );
        })}

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
            others glow softly. Muted vertices drop to a ghost line. */}
        {dotPos && VERTICES.map(v => {
          const isPrimary = heading === v.value;
          const isMuted = mutedVertices.has(v.value);
          const primaryOpacity = resonance ? resonanceToOpacity(resonance) : 0.3;
          const opacity = isMuted ? 0.08 : isPrimary ? primaryOpacity : 0.28;
          return (
            <line
              key={v.value + '-dash'}
              x1={dotPos.x} y1={dotPos.y}
              x2={v.cx} y2={v.cy}
              stroke={COPPER}
              strokeWidth={isPrimary ? 1.2 : 0.8}
              strokeDasharray={isPrimary ? '3 3' : '2 3'}
              opacity={opacity}
              style={{
                filter: isMuted
                  ? 'none'
                  : isPrimary
                    ? 'drop-shadow(0 0 2.5px rgba(196,145,95,0.45))'
                    : 'drop-shadow(0 0 2px rgba(196,145,95,0.25))',
                transition: 'opacity 0.25s ease, stroke-width 0.25s ease',
              }}
            />
          );
        })}

        {/* Vertex glow ring — pulsing copper halo only on the primary vertex */}
        {activeVertex && !mutedVertices.has(activeVertex.value) && (
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

        {/* Vertex dots — small tap targets on every vertex.
            Active pillars render as filled copper. Muted pillars render
            as a smaller hollow dot to keep the tap affordance visible. */}
        {VERTICES.map(v => {
          const isMuted = mutedVertices.has(v.value);
          const isPrimary = heading === v.value && !isMuted;
          const isSnappedHere = isSnapped && isPrimary;
          if (isMuted) {
            return (
              <circle
                key={v.value + '-dot'}
                cx={v.cx}
                cy={v.cy}
                r={3.5}
                fill="transparent"
                stroke="rgba(196,145,95,0.35)"
                strokeWidth={1}
                strokeDasharray="1.5 1.5"
                style={{ transition: 'all 0.25s ease', pointerEvents: 'none' }}
              />
            );
          }
          return (
            <circle
              key={v.value + '-dot'}
              cx={v.cx}
              cy={v.cy}
              r={isSnappedHere ? 5.5 : isPrimary ? 5 : 4}
              fill={isPrimary ? COPPER : 'rgba(196,145,95,0.55)'}
              style={{
                filter: isPrimary
                  ? 'drop-shadow(0 0 4px rgba(196,145,95,0.65))'
                  : 'drop-shadow(0 0 2px rgba(196,145,95,0.30))',
                transition: 'r 0.25s ease, fill 0.25s ease, filter 0.25s ease',
                pointerEvents: 'none',
              }}
            />
          );
        })}

        {/* Snap-in inner ring — appears when the center dot is locked on a vertex.
            Gives a clear "100% selected" affordance beyond the existing halo. */}
        {activeVertex && isSnapped && !mutedVertices.has(activeVertex.value) && (
          <circle
            cx={activeVertex.cx}
            cy={activeVertex.cy}
            r={9}
            fill="none"
            stroke={COPPER}
            strokeWidth={1.2}
            opacity={0.85}
            style={{ pointerEvents: 'none' }}
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

        {/* Vertex labels — muted labels get a leading × and dim */}
        {VERTICES.map(v => {
          const isActive = heading === v.value;
          const isMuted = mutedVertices.has(v.value);
          // Nudge top/bottom labels for readability
          const dyOffset = v.cy < CY - 20 ? -6 : v.cy > CY + 20 ? 14 : 4;
          const fill = isMuted
            ? 'rgba(255,255,255,0.22)'
            : isActive
              ? COPPER
              : 'rgba(255,255,255,0.42)';
          return (
            <text
              key={v.value + '-label'}
              x={v.lx}
              y={v.ly + dyOffset}
              textAnchor="middle"
              fontSize={isActive ? 10.5 : 9.5}
              fontWeight={isActive ? 600 : 400}
              fill={fill}
              style={{ transition: 'fill 0.2s, font-size 0.2s', pointerEvents: 'none' }}
            >
              {isMuted ? `× ${v.shortLabel}` : v.shortLabel}
            </text>
          );
        })}

        {/* Weight percentages — only shown in distribution mode (not snapped to vertex) */}
        {weights && !isSnapped && VERTICES.map(v => {
          if (mutedVertices.has(v.value)) return null;
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
      {/* Secondary gesture hint — tap-to-toggle is the new muting gesture */}
      {!snapOnly && (
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', textAlign: 'center', marginTop: 2, letterSpacing: '0.04em' }}>
          {mutedVertices.size > 0
            ? 'Tap a muted pillar to re-enable'
            : 'Tap a pillar\u2019s dot to mute it'}
        </p>
      )}
    </div>
  );
}
