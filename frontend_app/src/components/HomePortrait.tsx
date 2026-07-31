// HomePortrait — every session you've logged, stacked into one shape.
//
// This is an OBJECT, not a measurement, which is why it can sit on home
// without dragging the dashboard back in. No axes, no labels, no numbers on
// the graphic itself — it is the one view that loses nothing when shrunk,
// because it never encoded precise values. Tapping opens the instruments.

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { COPPER, PALE_YELLOW, FONT_EDITORIAL } from '../lib/theme.ts';
import {
  PILLAR_ORDER,
  prismVertices,
  toPolygonPoints,
  distributionPoints,
  peakWeight,
  pillarLabel,
} from '../lib/prismGeometry.ts';
import type { Pillar, PillarDistribution } from '../types/api.ts';

const SIZE = 104;
const CX = 52, CY = 52, R = 42;
const OUTLINE = toPolygonPoints(prismVertices(CX, CY, R, 0));

/** Layer opacity from the handoff — translucent copper, one per session. */
const LAYER_FILL = 'rgba(196,145,95,0.075)';
const LAYER_STROKE = 'rgba(196,145,95,0.128)';

const SPELLED = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen', 'Twenty',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** "Ninety sessions, one shape" reads better than "90 sessions". */
function spell(n: number): string {
  if (n <= 20) return SPELLED[n] ?? String(n);
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]!;
    const r = n % 10;
    return r === 0 ? t : `${t}-${SPELLED[r]!.toLowerCase()}`;
  }
  return String(n);
}

/**
 * One observed line about the shape — what's filling in, what's receding.
 * Compares the most recent third of sessions against the oldest third; with
 * too little history to compare, it just names the heaviest pillar.
 */
function observe(shapes: PillarDistribution[]): string {
  const totals = (set: PillarDistribution[]) => {
    const acc: Partial<Record<Pillar, number>> = {};
    for (const d of set) {
      for (const p of PILLAR_ORDER) acc[p.value] = (acc[p.value] ?? 0) + (d[p.value] ?? 0);
    }
    const sum = PILLAR_ORDER.reduce((s, p) => s + (acc[p.value] ?? 0), 0) || 1;
    return PILLAR_ORDER.map(p => ({ pillar: p.value, share: (acc[p.value] ?? 0) / sum }));
  };

  const heaviest = totals(shapes).sort((a, b) => b.share - a.share)[0];
  if (!heaviest) return '';

  // shapes arrive newest-first.
  if (shapes.length < 9) return `${pillarLabel(heaviest.pillar)} leads the shape.`;

  const third = Math.floor(shapes.length / 3);
  const recent = totals(shapes.slice(0, third));
  const older  = totals(shapes.slice(-third));
  const deltas = recent.map((r, i) => ({ pillar: r.pillar, delta: r.share - (older[i]?.share ?? 0) }));
  const rising  = [...deltas].sort((a, b) => b.delta - a.delta)[0]!;
  const falling = [...deltas].sort((a, b) => a.delta - b.delta)[0]!;

  if (rising.delta < 0.04 && falling.delta > -0.04) {
    return `${pillarLabel(heaviest.pillar)} leads the shape.`;
  }
  return `${pillarLabel(falling.pillar)} receding. ${pillarLabel(rising.pillar)} filling in.`;
}

interface Props {
  shapes: PillarDistribution[];
  sessionCount: number;
  /** `desk` drops the copper kicker and the chevron: in the desktop column
   *  the shape itself is the affordance, and the row sits under a rule the
   *  entry list already drew. */
  variant?: 'mobile' | 'desk';
}

export default function HomePortrait({ shapes, sessionCount, variant = 'mobile' }: Props) {
  const navigate = useNavigate();
  const observed = useMemo(() => observe(shapes), [shapes]);
  // One shared denominator across every session, so only the busiest session
  // reaches the rim and the rest nest inside it. That size variation is what
  // makes the overlay read as many sessions rather than one carved object.
  const layers = useMemo(() => {
    const scale = peakWeight(shapes);
    return shapes.map(d => distributionPoints(d, CX, CY, R, scale));
  }, [shapes]);

  // Nothing to overlay — day one has no portrait.
  if (shapes.length === 0) return null;

  const desk = variant === 'desk';

  return (
    <button
      type="button"
      onClick={() => navigate('/atlas')}
      className="j2-press"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: desk ? 20 : 16,
        width: '100%',
        textAlign: 'left',
        marginTop: desk ? 36 : 6,
        paddingTop: desk ? 0 : 20,
        borderTop: desk ? 'none' : '1px solid rgba(255,255,255,0.06)',
        background: 'none',
        cursor: 'pointer',
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ flex: 'none' }} aria-hidden>
        <polygon points={OUTLINE} fill="none" stroke="rgba(242,228,168,0.13)" strokeWidth={1.2} />
        {layers.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill={LAYER_FILL}
            stroke={LAYER_STROKE}
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <span style={{ flex: 1 }}>
        {!desk && (
          <span
            style={{
              display: 'block',
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: COPPER,
            }}
          >
            Your game
          </span>
        )}
        <span
          style={{
            display: 'block',
            fontFamily: FONT_EDITORIAL,
            fontSize: desk ? 21 : 20,
            fontWeight: 600,
            color: PALE_YELLOW,
            marginTop: desk ? 0 : 4,
            lineHeight: 1.2,
          }}
        >
          {spell(sessionCount)} {sessionCount === 1 ? 'session' : 'sessions'}, one shape
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: 'rgba(255,255,255,0.46)',
            marginTop: desk ? 5 : 6,
            lineHeight: desk ? 1.55 : undefined,
            maxWidth: desk ? 330 : undefined,
            textWrap: 'pretty',
          }}
        >
          {observed}
          {desk && (observed ? ' ' : '') + 'Click to open the instruments.'}
        </span>
      </span>

      {!desk && <span style={{ color: 'rgba(255,255,255,0.46)', fontSize: 20, flex: 'none' }}>›</span>}
    </button>
  );
}
