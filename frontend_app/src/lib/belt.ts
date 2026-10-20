// Shared BJJ belt types, colour constants, and texture helpers.
// Used by BeltBar (header), BeltDateBanner, and LogSessionMobileHeader.

export type BeltRank = 'white' | 'blue' | 'purple' | 'brown' | 'black';

export const BELT_COLORS: Record<BeltRank, string> = {
  white:  '#C8C4BF',
  blue:   '#1E4D8C',
  purple: '#6B2D8B',
  brown:  '#7B4A2D',
  black:  '#1C1C1C',
};

export const PATCH_COLORS: Record<BeltRank, string> = {
  white:  '#0D0D0D',
  blue:   '#0D0D0D',
  purple: '#0D0D0D',
  brown:  '#0D0D0D',
  black:  '#C41E3A',
};

/** Subtle woven-fabric texture: 1 px dark line every 3 px. */
export const ribbed = (color: string): string =>
  `repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.10) 2px, rgba(0,0,0,0.10) 3px), ${color}`;

/**
 * How long the current belt has been worn, in whole calendar months, as the
 * profile says it under the belt: "1 year, 7 months at this belt".
 * Months are counted on the calendar (Mar 14 → Apr 13 is still 0 months).
 */
export function timeAtBeltLabel(promotedAt: string, today: Date = new Date()): string {
  const [y, m, d] = promotedAt.slice(0, 10).split('-').map(Number) as [number, number, number];
  let months = (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
  if (today.getDate() < d) months -= 1;
  if (months < 1) return 'under a month at this belt';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return `${parts.join(', ')} at this belt`;
}
