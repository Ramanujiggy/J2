// BigPrism — Atlas's editorial pentagon visualization.
//
// Originally inlined in AtlasPage.tsx; extracted here so the merged
// AtlasPrismDeck can drive it from time-windowed hours data with smooth
// GSAP transitions instead of the static count-based shape it used before.
//
// Two render modes drive the polygon shape:
//   • First mount: animate from center outward (elastic.out, 1.1s) — same
//     debut feel as RadarChart's mount-time entry.
//   • Subsequent updates (range slider scrub, sub-view switch, etc.): morph
//     the polygon's `attr.points` smoothly from current → target. Eliminates
//     the redraw-from-empty flash that scrubbing the range would otherwise
//     trigger.

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { SKILL_COLORS } from '../charts/RadarChart.tsx';
import { SKILL_TAGS } from '../../lib/constants.ts';
import { PALE_YELLOW, COPPER } from '../../lib/theme.ts';

interface Props {
  /** Normalized hours per pillar in [0, 1], length === SKILL_TAGS.length, ordered by SKILL_TAGS. */
  normalized: number[];
  /**
   * Optional alignment overlay — per-pillar alignment % in [0, 1] (e.g. 0.75 = 75%
   * of intention-targeted hours matched). Renders as a faint copper polygon
   * behind the data shape, showing "what you said you'd train" against the
   * actual training shape. Pass undefined or all-zeros to skip the overlay.
   */
  alignmentNormalized?: number[];
  activeTag: string;
  onSelect: (tag: string) => void;
  size?: number;
}

const FLOOR = 0.08; // empty pillars still render as a small dot rather than collapsing onto center

export default function BigPrism({ normalized, alignmentNormalized, activeTag, onSelect, size = 560 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const N = SKILL_TAGS.length;

  const polyRef = useRef<SVGPolygonElement>(null);
  const alignPolyRef = useRef<SVGPolygonElement>(null);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const haloRefs = useRef<(SVGCircleElement | null)[]>([]);
  const mountedRef = useRef(false);

  const hasAlignmentOverlay =
    !!alignmentNormalized && alignmentNormalized.some(v => v > 0);

  // Compute geometry — outer reference vertices + data vertices pulled in by `norm`.
  const vs = SKILL_TAGS.map((tag, i) => {
    const angle = (2 * Math.PI / N) * i - Math.PI / 2;
    const norm = Math.max(FLOOR, normalized[i] ?? FLOOR);
    return {
      value: tag.value,
      label: tag.label,
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      dx: cx + R * norm * Math.cos(angle),
      dy: cy + R * norm * Math.sin(angle),
      angle,
      norm,
    };
  });
  const polyPoints = vs.map(v => `${v.x},${v.y}`).join(' ');
  const dataPoints = vs.map(v => `${v.dx},${v.dy}`).join(' ');
  const centerPoints = Array(N).fill(`${cx},${cy}`).join(' ');

  // Alignment overlay vertices — same geometry, radius driven by per-pillar
  // alignment instead of by hours. Floor matches the data polygon so empty
  // pillars stay readable.
  const alignPoints = SKILL_TAGS.map((_, i) => {
    const angle = (2 * Math.PI / N) * i - Math.PI / 2;
    const a = Math.max(FLOOR, alignmentNormalized?.[i] ?? FLOOR);
    return `${cx + R * a * Math.cos(angle)},${cy + R * a * Math.sin(angle)}`;
  }).join(' ');

  // Animate the data polygon + data dots + per-vertex halos in lockstep.
  // Effect re-runs whenever the normalized vector changes — first run does the
  // dramatic from-center reveal, subsequent runs morph in place.
  useEffect(() => {
    const poly = polyRef.current;
    if (!poly) return;

    if (!mountedRef.current) {
      mountedRef.current = true;
      gsap.fromTo(
        poly,
        { attr: { points: centerPoints } },
        { attr: { points: dataPoints }, duration: 1.1, ease: 'elastic.out(1, 0.75)' },
      );
      // Alignment overlay traces in just before the data shape so the
      // "what you said you'd train" backdrop reads first.
      if (alignPolyRef.current) {
        gsap.fromTo(
          alignPolyRef.current,
          { attr: { points: centerPoints } },
          { attr: { points: alignPoints }, duration: 0.9, ease: 'power3.out', delay: 0.05 },
        );
      }
      // Dots pop in after the polygon traces out
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        gsap.fromTo(
          dot,
          { attr: { cx, cy }, opacity: 0 },
          { attr: { cx: vs[i]!.dx, cy: vs[i]!.dy }, opacity: 0.85, duration: 0.5, ease: 'back.out(2)', delay: 0.6 + i * 0.06 },
        );
      });
    } else {
      // Subsequent: morph polygon + dots + halos + alignment overlay in place.
      gsap.to(poly, { attr: { points: dataPoints }, duration: 0.6, ease: 'power3.out' });
      if (alignPolyRef.current) {
        gsap.to(alignPolyRef.current, { attr: { points: alignPoints }, duration: 0.6, ease: 'power3.out' });
      }
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        gsap.to(dot, { attr: { cx: vs[i]!.dx, cy: vs[i]!.dy }, duration: 0.6, ease: 'power3.out' });
      });
      haloRefs.current.forEach((halo, i) => {
        if (!halo) return;
        const intensity = vs[i]!.norm;
        gsap.to(halo, {
          attr: { r: 14 + intensity * 38 },
          opacity: 0.10 + intensity * 0.28,
          duration: 0.6,
          ease: 'power3.out',
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized.join(','), alignmentNormalized?.join(',')]);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible', display: 'block' }}
    >
      <defs>
        <radialGradient id={`prism-lab-glow-${size}`} cx="50%" cy="50%">
          <stop offset="0%"   stopColor={PALE_YELLOW} stopOpacity="0.30" />
          <stop offset="50%"  stopColor={COPPER}      stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000"        stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`prism-lab-data-${size}`} cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor={PALE_YELLOW} stopOpacity="0.38" />
          <stop offset="60%"  stopColor={COPPER}      stopOpacity="0.18" />
          <stop offset="100%" stopColor={COPPER}      stopOpacity="0.06" />
        </radialGradient>
      </defs>

      {/* Ambient center glow */}
      <circle cx={cx} cy={cy} r={R * 1.25} fill={`url(#prism-lab-glow-${size})`} />

      {/* Concentric guide pentagons */}
      {[0.25, 0.5, 0.75, 1].map(t => (
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
        <line
          key={`spoke-${v.value}`}
          x1={cx} y1={cy} x2={v.x} y2={v.y}
          stroke="rgba(255,255,255,0.06)"
        />
      ))}

      {/* Outer reference pentagon — dashed, the "max" ring */}
      <polygon
        points={polyPoints}
        fill="none"
        stroke="rgba(196,145,95,0.30)"
        strokeWidth={1.2}
        strokeDasharray="3 4"
      />

      {/* Alignment overlay — what the user said they'd train (per-pillar
          alignment % from intentions). Sits behind the data polygon. */}
      {hasAlignmentOverlay && (
        <polygon
          ref={alignPolyRef}
          points={alignPoints}
          fill="rgba(196,145,95,0.10)"
          stroke={COPPER}
          strokeOpacity={0.55}
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(196,145,95,0.20))' }}
        />
      )}

      {/* Data polygon — shape morphs as `normalized` changes */}
      <polygon
        ref={polyRef}
        points={dataPoints}
        fill={`url(#prism-lab-data-${size})`}
        stroke={PALE_YELLOW}
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 10px rgba(242,228,168,0.22))' }}
      />

      {/* Per-vertex session-count halos — sized proportional to normalized intensity */}
      {vs.map((v, i) => {
        const intensity = v.norm;
        const color = SKILL_COLORS[v.value]?.stroke ?? COPPER;
        return (
          <circle
            key={`halo-${v.value}`}
            ref={el => { haloRefs.current[i] = el; }}
            cx={v.x}
            cy={v.y}
            r={14 + intensity * 38}
            fill={color}
            opacity={0.10 + intensity * 0.28}
            style={{ pointerEvents: 'none' }}
          />
        );
      })}

      {/* Outer ring on the active vertex */}
      {(() => {
        const v = vs.find(x => x.value === activeTag);
        if (!v) return null;
        const color = SKILL_COLORS[activeTag]?.stroke ?? COPPER;
        return (
          <circle
            cx={v.x} cy={v.y}
            r={size * 0.095}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          />
        );
      })()}

      {/* Small champagne markers at each data vertex (animate position) */}
      {vs.map((v, i) => (
        <circle
          key={`data-dot-${v.value}`}
          ref={el => { dotRefs.current[i] = el; }}
          cx={v.dx}
          cy={v.dy}
          r={3.5}
          fill={PALE_YELLOW}
          opacity={0.85}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* Vertex dots + labels — clickable */}
      {vs.map(v => {
        const isActive = v.value === activeTag;
        const color = SKILL_COLORS[v.value]?.stroke ?? COPPER;
        const dx = v.x - cx;
        const dy = v.y - cy;
        const textX = v.x + (dx > 1 ? 22 : dx < -1 ? -22 : 0);
        const textY = v.y + (dy > 1 ? 28 : dy < -1 ? -18 : 4);
        const anchor: 'start' | 'end' | 'middle' = dx > 1 ? 'start' : dx < -1 ? 'end' : 'middle';
        return (
          <g
            key={v.value}
            onClick={() => onSelect(v.value)}
            style={{ cursor: 'pointer' }}
          >
            <circle cx={v.x} cy={v.y} r={24} fill="transparent" />
            <circle
              cx={v.x}
              cy={v.y}
              r={isActive ? 11 : 6}
              fill={isActive ? PALE_YELLOW : color}
              style={isActive ? { filter: `drop-shadow(0 0 14px ${PALE_YELLOW})` } : undefined}
            />
            <text
              x={textX}
              y={textY}
              textAnchor={anchor}
              fill={isActive ? PALE_YELLOW : 'rgba(255,255,255,0.65)'}
              fontSize={14}
              fontWeight={isActive ? 700 : 500}
              letterSpacing={0.3}
              style={{ userSelect: 'none' }}
            >
              {v.label}
            </text>
          </g>
        );
      })}

      {/* Center mark */}
      <circle cx={cx} cy={cy} r={3} fill={PALE_YELLOW} opacity={0.6} />
    </svg>
  );
}
