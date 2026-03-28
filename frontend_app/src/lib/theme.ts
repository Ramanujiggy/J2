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

// ─── Accents ─────────────────────────────────────────────────────────────────

/** Champagne gold — all title text, nav links, and accent labels. */
export const PALE_YELLOW = '#F2E4A8' as const;

/** Warm caramel — card borders and wave tile arc strokes. */
export const COPPER = '#C4915F' as const;

// ─── Derived composites ───────────────────────────────────────────────────────

/** Standard card border (caramel at 45% opacity). */
export const COPPER_BORDER = 'rgba(196,145,95,0.45)' as const;

/** Standard card drop shadow — layered for depth. */
export const CARD_SHADOW = '0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)' as const;

/** Card surface — subtle top-edge rim-light over card background. */
export const CARD_SURFACE = `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 20%), ${CARD_BG}` as const;

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
