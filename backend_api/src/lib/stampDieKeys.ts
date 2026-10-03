// Server-side allowlist of valid stamp die keys.
//
// The backend can't import the frontend die catalog
// (frontend_app/src/lib/stampDies.ts), so the key list is duplicated here and
// used to reject unknown die_key values before they reach the DB. Keep the two
// in sync — same discipline as the theme.ts ↔ tailwind.config.ts brand mirror.

export const STAMP_DIE_KEYS = [
    'boa',            // manual "mark a moment" keepsake — repeatable
    'eight_gates_26', // Eight Gates capstone (26 consistent weeks) — auto-earned, once
] as const;

export type StampDieKey = (typeof STAMP_DIE_KEYS)[number];

export function isKnownDieKey(key: string): key is StampDieKey {
    return (STAMP_DIE_KEYS as readonly string[]).includes(key);
}
