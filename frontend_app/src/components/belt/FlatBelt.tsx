// FlatBelt — a BJJ belt drawn flat, end-on.
//
// Five layers, all of them load-bearing (per the Belt Design Guide): the
// cloth in the rank colour, the rank bar near the tip, tape stripes on the
// bar, a woven texture over everything, and stitch lines with inset
// shading that give the strip thickness. Remove any one and it goes back
// to being a coloured rectangle.
//
// DOM order matters: the weave sits AFTER the rank bar so the texture
// unifies cloth, bar and tape as one piece of fabric. It is
// pointer-events:none so the belt (and the sheet's tape slots) stay
// clickable through it.
//
// The weave is two opposing diagonal stripe sets at ±63°. The light set
// reads on dark cloth and the dark set reads on a white belt, so one
// texture serves every rank.
//
// This is the resting belt AND the sheet's larger editable belt — `size`
// switches the geometry. Interactive tape slots are the sheet's job and
// arrive through `renderStripes`.

import { BELT_CLOTH, rankBarColor, weaveBackground, type BeltRankKey } from '../../lib/beltCloth.ts';

export type BeltSize = 'rest' | 'sheet';

const GEOM = {
  rest:  { height: 38, radius: 5, barRight: 44, barWidth: 96,  stripeW: 7,  stripeX: (i: number) => 14 + i * 16, stitch: 6 },
  sheet: { height: 58, radius: 7, barRight: 64, barWidth: 150, stripeW: 11, stripeX: (i: number) => 22 + i * 25, stitch: 8 },
} as const;

const WEAVE_BG = weaveBackground();

/** The thickness — a light catch along the top, a heavier shadow beneath. */
const INSETS = 'inset 0 2px 0 rgba(255,255,255,0.05), inset 0 -3px 2px rgba(0,0,0,0.35)';
const INSETS_SHEET = 'inset 0 2px 0 rgba(255,255,255,0.05), inset 0 -4px 3px rgba(0,0,0,0.35)';

export function stripeLeft(size: BeltSize, i: number): number {
  return GEOM[size].stripeX(i);
}
export function stripeWidth(size: BeltSize): number {
  return GEOM[size].stripeW;
}

interface Props {
  rank: BeltRankKey;
  stripes: number;
  size?: BeltSize;
  /** Interactive belt (Profile's resting belt opens the promotion sheet). */
  onClick?: () => void;
  title?: string;
  /** Overrides the plain tape rendering — the sheet passes clickable
   *  stripes plus a dashed ghost slot for the next one. */
  renderStripes?: (size: BeltSize) => React.ReactNode;
  maxWidth?: number;
  className?: string;
}

export default function FlatBelt({
  rank, stripes, size = 'rest', onClick, title, renderStripes, maxWidth, className,
}: Props) {
  const g = GEOM[size];
  const cloth = BELT_CLOTH[rank];
  const barColor = rankBarColor(rank);
  const clamped = Math.max(0, Math.min(4, stripes));

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, title } : {})}
      className={className}
      aria-label={onClick ? title : undefined}
      style={{
        display: 'block',
        width: '100%',
        maxWidth,
        height: g.height,
        borderRadius: g.radius,
        background: cloth,
        border: '1px solid rgba(255,255,255,0.09)',
        position: 'relative',
        overflow: 'hidden',
        padding: 0,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: size === 'sheet' ? INSETS_SHEET : INSETS,
        transition: 'box-shadow 180ms ease',
      }}
      onMouseEnter={onClick ? (e => {
        // The copper ring is ADDED to the insets, never a replacement —
        // swapping them out would flatten the fabric on hover.
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px rgba(196,145,95,0.35), ${INSETS}`;
      }) : undefined}
      onMouseLeave={onClick ? (e => {
        (e.currentTarget as HTMLElement).style.boxShadow = INSETS;
      }) : undefined}
    >
      {/* Layer 2 — the rank bar, with layer 3 (tape) inside it */}
      <span
        style={{
          position: 'absolute', right: g.barRight, top: 0, bottom: 0,
          width: g.barWidth, background: barColor,
          display: 'block',
        }}
      >
        {renderStripes
          ? renderStripes(size)
          : Array.from({ length: clamped }, (_, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: g.stripeX(i), width: g.stripeW,
                  // Slightly translucent so the weave shows through — tape
                  // is cloth too.
                  background: 'rgba(255,255,255,0.88)',
                }}
              />
            ))}
      </span>

      {/* Layer 4 — the weave, over cloth AND bar AND tape */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: WEAVE_BG, pointerEvents: 'none' }} />

      {/* Layer 5 — stitch lines */}
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0, top: g.stitch, height: 0,
          borderTop: '1px dashed rgba(255,255,255,0.13)', pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute', left: 0, right: 0, bottom: g.stitch, height: 0,
          borderTop: '1px dashed rgba(0,0,0,0.3)', pointerEvents: 'none',
        }}
      />
    </Tag>
  );
}
