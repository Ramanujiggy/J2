// StudyGlyph — the five pillars as points, with the studied one lit.
//
// Small enough to sit inline in a sentence. It is a pointer, not a chart:
// no web, no fill, no scale — just which corner of the prism a run of
// sessions kept landing on.

import { PILLAR_ORDER, vertexAngle } from '../../lib/prismGeometry.ts';
import { COPPER, PALE_YELLOW } from '../../lib/theme.ts';
import type { Pillar } from '../../types/api.ts';

interface Props {
  /** The lit pillar. Null renders every point dim — nothing has emerged. */
  pillar: Pillar | null;
  size?: number;
}

export default function StudyGlyph({ pillar, size = 26 }: Props) {
  const cx = 44, cy = 44, r = 30;
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" style={{ flex: 'none' }} aria-hidden>
      {PILLAR_ORDER.map((p, i) => {
        const a = vertexAngle(i);
        const on = p.value === pillar;
        return (
          <circle
            key={p.value}
            cx={(cx + Math.cos(a) * r).toFixed(1)}
            cy={(cy + Math.sin(a) * r).toFixed(1)}
            r={on ? 6 : 3}
            fill={on ? PALE_YELLOW : `${COPPER}66`}
          />
        );
      })}
    </svg>
  );
}
