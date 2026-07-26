// Central colour token registry for the Journada frontend.
//
// All hardcoded hex values and recurring style composites live here.
// Import from this file rather than writing raw colour strings in components.
// The Tailwind brand tokens (brand-orange, brand-green, etc.) are defined in
// tailwind.config.ts and used via Tailwind classes — those are NOT duplicated here.

// ─── Surfaces ────────────────────────────────────────────────────────────────

/** Page background — deep forest green. Matches `brand-dark` Tailwind token. */
export const PAGE_BG = '#0D1A14' as const;

/** Raised card / component background — sits visibly above the page. */
export const CARD_BG = '#152E22' as const;

// ─── Surface hierarchy ──────────────────────────────────────────────────────

/** Level 0 — page background. Alias for PAGE_BG. */
export const SURFACE_0 = PAGE_BG;

/** Level 1 — primary raised card. Alias for CARD_BG. */
export const SURFACE_1 = CARD_BG;

/** Level 2 — sub-section within a card (feature groups, stat strips, info blocks). */
export const SURFACE_2 = 'rgba(255,255,255,0.035)' as const;

/** Level 3 — interactive element / input resting state within a card. */
export const SURFACE_3 = 'rgba(255,255,255,0.08)' as const;

/** Border pairing for SURFACE_2 containers. */
export const SURFACE_2_BORDER = 'rgba(255,255,255,0.07)' as const;

/** Border pairing for SURFACE_3 containers. */
export const SURFACE_3_BORDER = 'rgba(255,255,255,0.10)' as const;

// ─── Accents ─────────────────────────────────────────────────────────────────

/** Champagne gold — all title text, nav links, and accent labels. */
export const PALE_YELLOW = '#F2E4A8' as const;

/** Warm caramel — card borders and wave tile arc strokes. */
export const COPPER = '#C4915F' as const;

/** Sage — reserved for entry-list dates on Home. It is what makes the list
 *  read as journal pages rather than table rows; do not spend it elsewhere. */
export const SAGE = '#8FB56A' as const;

/** Orange — the ONLY colour permitted on a tappable affordance. Copper
 *  records, champagne displays, orange acts. */
export const BRAND_ORANGE = '#DA7422' as const;

// ─── Prestige accents ────────────────────────────────────────────────────────

/** Prestige green — 8th Gate milestone. Electric, fully saturated, teal-shifted. */
export const PRESTIGE_GREEN = '#00E67A' as const;

/** Prestige green glow — box-shadow / ring for gate indicators. */
export const PRESTIGE_GREEN_GLOW = 'rgba(0,230,122,0.50)' as const;

/** Prestige teal — greenish-blue variant for future prestige streak features. */
export const PRESTIGE_TEAL = '#00D4AA' as const;

/** Prestige teal glow — box-shadow for teal accent. */
export const PRESTIGE_TEAL_GLOW = 'rgba(0,212,170,0.45)' as const;

/** Prestige blue — streak sheen and consecutive-day glow. Electric sky, fully saturated. */
export const PRESTIGE_BLUE = '#00B4FF' as const;

/** Prestige blue glow — box-shadow / ring for streak indicators. */
export const PRESTIGE_BLUE_GLOW = 'rgba(0,180,255,0.50)' as const;

// ─── Derived composites ───────────────────────────────────────────────────────

/** Standard card border (caramel at 45% opacity). */
export const COPPER_BORDER = 'rgba(196,145,95,0.45)' as const;

/** Standard card drop shadow — 3-layer chromatic depth + whisper inset rim-light. */
export const CARD_SHADOW =
  '0 1px 3px rgba(0,0,0,0.24), 0 6px 16px rgba(13,26,20,0.45), 0 16px 48px rgba(196,145,95,0.06), inset 0 0 0 1px rgba(255,255,255,0.045)' as const;

/** Standalone whisper border — subtle inset rim-light for layered depth. */
export const WHISPER_BORDER = 'inset 0 0 0 1px rgba(255,255,255,0.045)' as const;

/** Backlit card glow — replaces COPPER_BORDER + CARD_SHADOW on major surfaces.
 *  Deep drop shadow + faint ambient copper bloom beneath the card.
 *  Pair with CARD_GLOW_BORDER for near-invisible edge geometry. */
export const CARD_GLOW =
  '0 2px 8px rgba(0,0,0,0.55), 0 12px 40px rgba(0,0,0,0.55), 0 0 32px 10px rgba(196,145,95,0.07), inset 0 1px 0 rgba(255,255,255,0.06)' as const;

/** Ghost border to pair with CARD_GLOW — defines card geometry without the "webpage click" gold line. */
export const CARD_GLOW_BORDER = 'rgba(196,145,95,0.08)' as const;

/** Title glow — used on the large "Journada" wordmark. */
export const GLOW_TITLE = '0 0 14px rgba(242,228,168,0.45), 0 0 32px rgba(242,228,168,0.2)' as const;

/** Soft glow — GLOW_TITLE at ~70% intensity, used on stat numbers and section headings. */
export const GLOW_SOFT = '0 0 14px rgba(242,228,168,0.3), 0 0 30px rgba(242,228,168,0.14)' as const;

/** Nav glow — used on smaller nav links and buttons. */
export const GLOW_NAV = '0 0 12px rgba(242,228,168,0.5), 0 0 24px rgba(242,228,168,0.22)' as const;

// ─── Heatmap cells ────────────────────────────────────────────────────────────

/** Rest / empty day cell — slightly darker than page background. */
export const HEATMAP_REST = '#0A1610' as const;

/** Future day cell (no session yet) — slightly darker than rest. */
export const HEATMAP_FUTURE = '#08120D' as const;

/** Outside-current-year cell background (rendered at 18% opacity). */
export const HEATMAP_OUTSIDE_YEAR = '#0D1812' as const;

/** Sticky calendar column-header row background — marginally lighter than page bg. */
export const HEATMAP_HEADER_BG = '#111D16' as const;

// ─── Desktop editorial tokens (Phase 1 of desktop redesign) ─────────────────

/** Darker copper — hover / shadow variant of COPPER. */
export const COPPER_DEEP = '#8E6741' as const;

/** Editorial serif stack — use for large stat numbers, section titles,
 *  and anywhere `font-family: var(--font-editorial)` appears in CSS. */
export const FONT_EDITORIAL = '"Cormorant Garamond", Georgia, serif' as const;

/** Wordmark serif stack — identical to FONT_EDITORIAL but semantically
 *  reserved for the brand mark and page-level display titles. */
export const FONT_WORDMARK = '"Cormorant Garamond", "Cormorant", Georgia, serif' as const;

/** Session-intensity color scale. Level 0 is the "rest / empty" swatch.
 *  Indices 1-5 map to Drill → Light → Steady → Intense → Hard roll.
 *  The ladder walks moss → champagne → copper, staying inside the brand
 *  register (forest / copper / champagne) instead of pivoting through
 *  saturated lime green and fluorescent orange. */
export const INT_COLORS = {
  0: 'rgba(255,255,255,0.06)',
  1: '#5E8A5C',   // Drill: muted moss — sits gently on forest card
  2: '#7BA177',   // Light: warmer moss — readable but quiet
  3: '#A8B97A',   // Steady: champagne-touched green — the pivot point
  4: '#D4B86A',   // Intense: champagne — fully gold, no neon
  5: '#C4915F',   // Hard roll: COPPER — brand caramel, no fluorescent orange
} as const;

/** Human labels for the intensity scale, aligned with INT_COLORS indices. */
export const INT_LABELS = ['', 'Drill', 'Light', 'Steady', 'Intense', 'Hard roll'] as const;

/** Subtle glow used on mid-size section headings and champagne body text. */
export const GLOW_SUBTLE = '0 0 8px rgba(242,228,168,0.22)' as const;

// ─── Status colors ────────────────────────────────────────────────────────────
//
// Brand-aligned error / success / info accents. These replace the scattered
// `#F87171`, `text-red-400`, and `rgba(248,113,113,*)` literals that earlier
// pages adopted ad-hoc. Reach for these — and the Toast primitive — instead
// of writing raw colour strings for status states.
//
// The palette stays inside the warm forest register: error is a desaturated
// terracotta (not Tailwind cold-red), success is the moss-3 from INT_COLORS,
// info reuses copper because copper IS our voice for "noteworthy."

/** Status: error / destructive / failure. Warm terracotta, not cold red. */
export const STATUS_ERROR = '#E07560' as const;

/** Status: error tinted backgrounds (toasts, inline error pills). */
export const STATUS_ERROR_BG = 'rgba(224,117,96,0.10)' as const;

/** Status: error border. */
export const STATUS_ERROR_BORDER = 'rgba(224,117,96,0.30)' as const;

/** Status: success / saved / sent. Reuses moss-3 from the intensity ladder. */
export const STATUS_SUCCESS = '#A8B97A' as const;

/** Status: success tinted backgrounds. */
export const STATUS_SUCCESS_BG = 'rgba(168,185,122,0.10)' as const;

/** Status: success border. */
export const STATUS_SUCCESS_BORDER = 'rgba(168,185,122,0.30)' as const;

/** Status: info / neutral notice — reuses copper as the voice accent. */
export const STATUS_INFO = COPPER;

/** Status: info tinted backgrounds. */
export const STATUS_INFO_BG = 'rgba(196,145,95,0.10)' as const;

/** Status: info border. */
export const STATUS_INFO_BORDER = 'rgba(196,145,95,0.30)' as const;

// ─── Form inputs ──────────────────────────────────────────────────────────────

/**
 * Shared inline style for all <input type="date"> elements.
 * Use alongside DATE_INPUT_CLASS for consistent resting-state appearance.
 * colorScheme: 'dark' makes the native iOS/browser picker respect dark mode.
 */
export const DATE_INPUT_STYLE = {
  backgroundColor: SURFACE_3,
  border: `1px solid ${COPPER_BORDER}`,
  colorScheme: 'dark' as const,
  paddingRight: '2.5rem',  // room for native calendar icon on iOS/desktop
};
