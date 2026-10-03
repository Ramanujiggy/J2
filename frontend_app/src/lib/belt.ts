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
