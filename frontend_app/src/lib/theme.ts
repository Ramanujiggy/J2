// Central colour token registry for the Journada frontend.
//
// All hardcoded hex values and recurring style composites live here.
// Import from this file rather than writing raw colour strings in components.
// The Tailwind brand tokens (brand-orange, brand-green, etc.) are defined in
// tailwind.config.ts and used via Tailwind classes — those are NOT duplicated here.

// ─── Surfaces ────────────────────────────────────────────────────────────────

/** Page background — also the tile fill in WaveBackground. Matches `brand-dark` Tailwind token. */
export const PAGE_BG = '#111e2b' as const;

/** Raised card / component background — sits visibly above the page. */
export const CARD_BG = '#1a2f40' as const;

// ─── Accents ─────────────────────────────────────────────────────────────────

/** Pale gold — all title text, nav links, and accent labels. */
export const PALE_YELLOW = '#F0DFA0' as const;

/** Copper/clay — card borders and wave tile arc strokes. */
export const COPPER = '#B87A55' as const;

// ─── Derived composites ───────────────────────────────────────────────────────

/** Standard card border (copper at 45% opacity). */
export const COPPER_BORDER = 'rgba(184,122,85,0.45)' as const;

/** Standard card drop shadow. */
export const CARD_SHADOW = '0 4px 24px rgba(0,0,0,0.4)' as const;

/** Title glow — used on the large "Journada" wordmark. */
export const GLOW_TITLE = '0 0 12px rgba(240,223,160,0.4), 0 0 28px rgba(240,223,160,0.18)' as const;

/** Soft glow — GLOW_TITLE at ~70% intensity, used on stat numbers and section headings. */
export const GLOW_SOFT = '0 0 12px rgba(240,223,160,0.28), 0 0 28px rgba(240,223,160,0.13)' as const;

/** Nav glow — used on smaller nav links and buttons. */
export const GLOW_NAV = '0 0 10px rgba(240,223,160,0.5), 0 0 22px rgba(240,223,160,0.2)' as const;

// ─── Heatmap cells ────────────────────────────────────────────────────────────

/** Rest / empty day cell — slightly darker than page background. */
export const HEATMAP_REST = '#0d1a26' as const;

/** Future day cell (no session yet) — slightly darker than rest. */
export const HEATMAP_FUTURE = '#0a1620' as const;

/** Outside-current-year cell background (rendered at 18% opacity). */
export const HEATMAP_OUTSIDE_YEAR = '#111e26' as const;

/** Sticky calendar column-header row background — marginally lighter than page bg. */
export const HEATMAP_HEADER_BG = '#141e2b' as const;
