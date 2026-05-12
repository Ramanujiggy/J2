// Barrel for `components/visuals/` — Journada's reusable visual primitives.
// Each primitive is also exported as a default from its own file so
// tree-shaking remains effective if a surface only needs one of them.
//
// The system is built around one meta-principle, lifted from Refero
// research on brand-coherent apps (Cosmos, Endel, 222, Bear, Day One):
//
//   "One symbol, recurring at different scales — texture under, focal
//    over, never both at once."
//
// Translation to Journada:
//   - PrismMotif        — the one symbol (pentagon). Reserved for hero
//                         surfaces; render only ONE per screen.
//   - SeigaihaPattern   — the one texture (Japanese fish-scale wave).
//                         Layered behind content, never above.
//   - MiniPrismField    — recurrence of the symbol at smaller scale.
//                         Lives in negative space; pairs well with
//                         SeigaihaPattern, never with PrismMotif on the
//                         same surface (would compete).
//
// See each component's docblock for prop API and reuse contexts.

export { default as PrismMotif } from './PrismMotif.tsx';
export type { PrismMotifProps, PrismIntensity, PrismBreathRate, PrismColor } from './PrismMotif.tsx';

export { default as SeigaihaPattern } from './SeigaihaPattern.tsx';
export type { SeigaihaPatternProps } from './SeigaihaPattern.tsx';

export { default as MiniPrismField } from './MiniPrismField.tsx';
export type { MiniPrismFieldProps, MiniPrism, CrystPair } from './MiniPrismField.tsx';
