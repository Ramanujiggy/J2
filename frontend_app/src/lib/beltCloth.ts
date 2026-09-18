// Belt cloth colours for the flat, end-on belt (FlatBelt + the promotion
// sheet). These are the *cloth* values from the desktop handoff's Belt
// Design Guide and are deliberately separate from lib/belt.ts's BELT_COLORS,
// which drives the older animated tie-on BeltBar and its patch/ribbing.
//
// Rank bar: deep red on a black belt, near-black on every other rank.

export type BeltRankKey = 'white' | 'blue' | 'purple' | 'brown' | 'black';

export const BELT_RANK_ORDER: readonly BeltRankKey[] = ['white', 'blue', 'purple', 'brown', 'black'];

export const BELT_CLOTH: Record<BeltRankKey, string> = {
  white:  '#e8e2d2',
  blue:   '#2b4a8a',
  purple: '#4a2a63',
  brown:  '#4a3220',
  black:  '#161616',
};

export const RANK_BAR_BLACK = '#7a1f1f';
export const RANK_BAR_DEFAULT = '#111';

/** The rank bar colour for a given cloth. */
export function rankBarColor(rank: BeltRankKey): string {
  return rank === 'black' ? RANK_BAR_BLACK : RANK_BAR_DEFAULT;
}

/** The woven texture: two opposing diagonal stripe sets at ±63°. The light
 *  set reads on dark cloth and the dark set reads on a white belt, so one
 *  texture serves every rank. `scale` divides the period so a belt that is
 *  transform-scaled up (the promotion ceremony) keeps the same on-screen
 *  density as the resting belt. */
export function weaveBackground(scale = 1): string {
  const a = 3 / scale;
  const b = 7 / scale;
  return [
    `repeating-linear-gradient(63deg, rgba(255,255,255,0.05) 0 ${a}px, transparent ${a}px ${b}px)`,
    `repeating-linear-gradient(-63deg, rgba(0,0,0,0.16) 0 ${a}px, transparent ${a}px ${b}px)`,
  ].join(', ');
}

const ORDINALS = ['first', 'second', 'third', 'fourth'] as const;

/** "Black belt, second stripe" — the live name shown on the sheet. */
export function beltDisplayName(rank: BeltRankKey, stripes: number): string {
  const belt = `${rank[0]!.toUpperCase()}${rank.slice(1)} belt`;
  return stripes > 0 ? `${belt}, ${ORDINALS[stripes - 1]} stripe` : belt;
}

export function isBeltRank(value: string | null | undefined): value is BeltRankKey {
  return !!value && (BELT_RANK_ORDER as readonly string[]).includes(value);
}
