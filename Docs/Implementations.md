# Third-Party Implementations

A reference for significant library integrations — why each was added, how it's wired up, and where to use it.

---

## D3.js

**Package:** `d3` v7.9.0 + `@types/d3`
**Installed:** frontend_app only
**Reference:** [d3js.org](https://d3js.org) · [D3 Graph Gallery](https://d3-graph-gallery.com) (examples site — not a package)

---

### Why D3

The existing analytics charts in `SkillRadar.tsx` are hand-rolled SVG. That works for the current 4 static views, but the Phase 2 Dynamic Pillar Engine charts (Traction gauge, polarity drill-down per pillar node, active Heading pulse) require:

- Non-linear scales and arc generators (gauge)
- Radial layout math with variable depth (drill-down on pentagon vertices)
- Smooth data-driven transitions without manual keyframe management

D3 provides these as composable utilities. It also fully covers the existing chart shapes (radar/pentagon, bar, donut) — so migrating the current charts to D3 is possible whenever it makes sense, without adding a second charting library.

---

### What the D3 Graph Gallery Is

The D3 Graph Gallery ([d3-graph-gallery.com](https://d3-graph-gallery.com)) is a **free reference website** — not a package. It hosts 400+ reproducible D3 chart examples with editable source code, organised by chart type. Use it to find the starting pattern for any new visualisation before writing from scratch.

Relevant categories for this project:
| Gallery Category | Journada Use Case |
|---|---|
| Radar / Spider | Grappling Prism pentagon |
| Bar chart | Volume by Month |
| Donut / Pie | Gi vs No-Gi, Session Format |
| Arc / Gauge | Traction score (Phase 2) |
| Grouped bar | Polarity drill-down per pillar (Phase 2) |

---

### React + D3 Integration Pattern

D3 manipulates the DOM directly; React owns the DOM via the virtual DOM. Letting both write to the same nodes causes conflicts. The recommended pattern for this project:

**D3 for math, React for rendering.**

```tsx
import { scaleLinear, lineRadial, arc } from 'd3';

// ── D3 computes geometry ──────────────────────────────────────────────────────
const radialScale = scaleLinear()
  .domain([0, maxHours])
  .range([0, CHART_RADIUS]);

const pathData = lineRadial<DataPoint>()
  .angle((d, i) => (i / data.length) * 2 * Math.PI)
  .radius(d => radialScale(d.hours));

// ── React renders the SVG ────────────────────────────────────────────────────
return (
  <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
    <path d={pathData(data) ?? ''} fill="..." stroke="..." />
  </svg>
);
```

**Rules:**
- Import only the D3 sub-modules you need — tree-shaking keeps bundle size down
- Never call `d3.select()` on a React-managed element (use refs + `useEffect` only for D3 transitions/animations)
- Derive all SVG path strings and coordinates in render scope, pass them as JSX props

**When to use `useEffect` + `d3.select`:**
Only for animated transitions (e.g. the Traction gauge needle moving on data change). Even then, target a `ref`-attached node that React treats as opaque.

---

### Planned Usage in Journada

| Chart | File (planned) | D3 modules |
|---|---|---|
| Traction gauge | `TractionGauge.tsx` | `d3-scale`, `d3-shape` (arc) |
| Polarity drill-down | `PolarityBreakdown.tsx` | `d3-scale`, `d3-shape` (arc), `d3-transition` |
| Active Heading pulse | inline in `SkillRadar.tsx` | `d3-interpolate`, `d3-transition` |
| Grappling Prism (migration) | `SkillRadar.tsx` refactor | `d3-scale`, `d3-shape` (lineRadial) |

---

### Import Style

Always import from the specific D3 sub-package, not the full `d3` barrel:

```ts
// ✅ Tree-shakeable
import { scaleLinear, scaleRadial } from 'd3-scale';
import { arc, lineRadial, pie }     from 'd3-shape';
import { interpolate }              from 'd3-interpolate';
import { select }                   from 'd3-selection';

// ❌ Imports the entire library
import * as d3 from 'd3';
```

All sub-packages (`d3-scale`, `d3-shape`, etc.) are included in the `d3` install — no separate installs needed.

---

### TypeScript

Types are included in the `@types/d3` package (installed alongside `d3`). All scale, shape, and selection functions are fully typed. When D3 infers data types generically, annotate the call site:

```ts
const myArc = arc<PieArcDatum<DataPoint>>();
```

---

## Focus Areas & Adaptive Prism

**Status:** Sprint 6 — active this week
**Dependencies:** Pillar Engine Phase 1 (complete)
**Supersedes:** The original "Custom Pillars" plan (which assumed exactly 5 + discipline templates)

---

### Core Philosophy

> "The Prism is what you earn by having a broad game, not what we impose."

The old model was hierarchical: five fixed BJJ pillars → users align to them. The new model is relational: **users define their own vocabulary, then intentions and sessions relate back to it.** No taxonomy to maintain, no discipline-specific templates, no forced breadth.

A user who trains donkey guard, rubber guard, spider guard, half guard, and butterfly guard has a perfectly valid 5-vertex Prism — all within what the old system called a single pillar. A user who only cares about "competition sparring" has a single focus area and gets a simple alignment arc instead of a half-empty pentagon.

The shape follows intent: 1 area → bar, 2 → split gauge, 3 → triangle, 4 → diamond, 5 → pentagon.

---

### Focus Areas (1–5, user-defined)

**What they are:**
- 1 to 5 freeform text labels that represent what the user is currently working on
- Set during onboarding ("What are you working on?") or on first Analytics visit for existing users
- Editable anytime from Profile
- No templates, no scaffolding, no discipline detection — trust the user

**How they connect:**
- **Session logging:** The `heading` selector reads from the user's focus areas (instead of hardcoded `SKILL_TAGS`)
- **Intentions:** The user targets one of their focus areas when setting an intention. Alignment metrics compare the intention's target focus area vs actual session headings.
- **Prism:** The visualization adapts vertex count to the user's focus area count
- **Traction:** T = (Objective Alignment × 0.7) + (Subjective Resonance × 0.3) — objective alignment measures how well sessions match stated focus areas. This metric is comparable *across users regardless of focus area count*, making it the universal currency for future social features (Amaze).

**What happens when focus areas change:**
- Historical sessions retain their `heading` string — it's just a label, not a foreign key
- The Prism shows retired headings as grayed-out labels (visible in the chart but not part of the active shape)
- No data loss, no migration needed on change

**Data model:**

```sql
-- Migration: add focus_areas to users
ALTER TABLE users ADD COLUMN focus_areas JSONB DEFAULT NULL;
-- Example value: [{"value":"half_guard","label":"Half Guard"},{"value":"standup","label":"Stand-up"}]
-- NULL = legacy user, falls back to default SKILL_TAGS constant
-- Validated: array of 1–5 objects, each with value (slug) + label (display name)
```

**Onboarding flow:**
1. After registration → "What are you working on?"
2. User types 1–5 focus area labels (simple text inputs, add/remove buttons)
3. System generates slug `value` from label (lowercase, spaces → underscores)
4. Saved to `users.focus_areas`
5. Skip option → defaults to current BJJ SKILL_TAGS (backward compat)

**Backward compatibility:**
- `users.focus_areas = NULL` → all existing code reads from `SKILL_TAGS` constant (no change)
- `users.focus_areas = [...]` → session logging, intentions, and Prism read from that array
- Existing sessions with old heading values (e.g. "standup") are unaffected — heading is a string, not a FK

---

### Adaptive Prism Visualization

The Prism component receives `focusAreas` (1–5 items) and renders the appropriate shape:

| Count | Shape | Visualization |
|---|---|---|
| 1 | Alignment arc | Single radial gauge — how well are sessions matching this one target? |
| 2 | Split gauge | Two-sided comparison — time/alignment split between the two areas |
| 3 | Triangle | Radar triangle with 3 vertices |
| 4 | Diamond | Radar diamond with 4 vertices |
| 5 | Pentagon | Classic Prism pentagon |

Each shape normalises to max hours in the selected time window (30d/60d/90d/all), same as today.

**Easter egg:** When all 5 vertices are within 10% of each other (balanced pentagon), display the quote: *"The Prism is what you earn by having a broad game, not what we impose."*

---

### Cross-User Comparison (Future — Amaze)

When the social layer ships, comparison is based on **Traction** (alignment to stated goals), not on shape. My 2-focus profile and your 5-focus profile are both valid — the metric that's comparable is "how well are you executing against your own plan." This makes the relational model work at population scale without forcing everyone into the same taxonomy.

---

## The Grappling Prism — Gesture-Based Data Entry

**Status:** Design spec complete, implementation planned
**Dependencies:** Focus Areas (for adaptive vertex count), PillarPrism.tsx (existing gesture foundation)
**Existing component:** `frontend_app/src/components/PillarPrism.tsx` — already has pentagon SVG, pointer event handling, dot clamping, nearest-vertex detection, and haptic feedback

---

### Core Concept

Replace discrete pillar selection (tap one of 5 buttons) with a **spatial gesture** on the Prism SVG. Instead of saying "I played guard today," the user places their thumb on the pentagon to express a distribution — "I was 60% guard, 30% passing, 10% standup." The gesture captures spatial intuition that humans are naturally better at expressing than numerical estimation.

The coordinate system treats the SVG as a Cartesian plane with origin (0,0) at the pentagon center. Each vertex sits at distance R from center.

---

### Model A: Snapshot (Inverse Distance Weighting)

**Best for:** Quick "what happened?" summaries. Single touch-and-release.

When the user releases their thumb at position P(x,y), calculate 5 pillar weights using **Inverse Distance Weighting (IDW)**:

For each vertex V_i:
1. Distance: `d_i = sqrt((x_p - x_i)² + (y_p - y_i)²)`
2. Raw weight: `w_i = 1 / d_i^p` (where p=2 sharpens focus near vertices)
3. Normalize: `W_i = w_i / sum(all w_j)` so weights sum to 1.0

**Result:** Five float values (0.0–1.0) summing to 1.0. Touching near a vertex gives ~0.7+ to that pillar and residual to neighbors.

**TypeScript (extends existing PillarPrism.handlePointer):**

```ts
function calculateWeights(px: number, py: number): Record<string, number> {
  const distances = VERTICES.map(v => Math.hypot(px - v.cx, py - v.cy));
  const rawWeights = distances.map(d => 1 / Math.max(d, 0.01) ** 2);
  const total = rawWeights.reduce((a, b) => a + b, 0);
  const normalized: Record<string, number> = {};
  VERTICES.forEach((v, i) => { normalized[v.value] = rawWeights[i] / total; });
  return normalized;
}
```

### Model B: Path (Temporal Vector Summation)

**Best for:** Capturing the "story" and "flow" of a roll. Drag gesture over time.

As the user moves their thumb, sample position every ~50ms. Each point is a "vote" for nearby pillars.

1. **Sampling:** Collect `S = {P_1, P_2, ..., P_n}` during drag
2. **Density mapping:** Each point's IDW weights are summed across the entire path, then normalized
3. **Transition detection:** If path moves from Guard zone to Passing zone, flag a "Transition" event

**Result:** Same 5-float output as Snapshot, but reflects the distribution of the entire gesture trajectory. A path that starts at Guard and ends at Submissions gives a different distribution than a static touch between them.

**Intensity from path:** `intensity = (maxDistance / R) * 100` — the furthest point from center indicates maximum effort/reach.

---

### Current State vs. Spec

Phase 1 (snapshot/IDW) is **shipped**. Phase 2 (path tracking) is still planned.

| Aspect | Current (PillarPrism.tsx) | Phase 2 Target |
|--------|--------------------------|----------------|
| Input model | ✅ Snap-to-vertex + IDW interior distribution + per-vertex muting | Path tracking — Model B: temporal sampling + transition detection |
| Output | ✅ `heading: string, resonance: number, weights: Record<string, number>` | Add per-segment vector summation across drag duration |
| Gesture | ✅ Tap-on-dot toggles mute, drag-in-interior places center dot, tap-elsewhere snaps via IDW | Continuous weight calc with timestamped samples for the chronological trail |
| Database | ✅ `heading VARCHAR(20)`, `resonance SMALLINT`, `pillar_distribution JSONB`, `canonical_position_ids UUID[]` | Add `pillar_path JSONB` (array of `{t, weights}` samples) for trail playback |

**Shipped (Phase 1):**
- IDW weight calculation across the active vertex set (muted excluded entirely)
- Snap threshold at 20% of R for clean vertex selection
- Vertex muting via short-tap on the visible vertex dot (replaces an earlier long-press model — short-tap is more discoverable, paired with dot-as-affordance)
- Live percentage labels in distribution mode
- `pillar_distribution JSONB` column on `training_sessions` (migration 009) with backend renormalisation
- Server `sanitizePillarDistribution` filters invalid keys, drops zero-weights, renormalises to sum 1.0
- Zero-sum analytics via `sessionPillarHours()` — total mat hours always equals sum of per-pillar hours
- iOS-native animation polish (toggle pump, snap-in inner ring overshoot, vertex dot pump) — see "Animation Polish Pass" section below

**Still planned (Phase 2):**
- Path point sampling array + interval timer for chronological trail
- Transition detection (zone changes during drag) for "guard → passing in 30s" type segments
- Trail playback visualisation in SessionDetailModal
- `pillar_path` schema design (size budget vs. fidelity)

---

### Database Impact

**Option A: JSONB column (recommended for flexibility)**
```sql
ALTER TABLE training_sessions ADD COLUMN pillar_weights JSONB DEFAULT NULL;
-- Example: {"standup": 0.12, "passing": 0.08, "guard": 0.62, "pins": 0.05, "submissions": 0.13}
```

**Option B: Five NUMERIC columns**
```sql
ALTER TABLE training_sessions
  ADD COLUMN w_standup    NUMERIC(4,3) DEFAULT NULL,
  ADD COLUMN w_passing    NUMERIC(4,3) DEFAULT NULL,
  ADD COLUMN w_pins       NUMERIC(4,3) DEFAULT NULL,
  ADD COLUMN w_submissions NUMERIC(4,3) DEFAULT NULL,
  ADD COLUMN w_guard      NUMERIC(4,3) DEFAULT NULL;
```

JSONB is preferred because it works with the Focus Areas system (variable vertex count, user-defined labels) without schema changes per user.

**Backward compatibility:** Sessions with `pillar_weights = NULL` continue to use `heading` + `tags` for analytics. The Prism visualization reads `pillar_weights` when present, falls back to deriving weights from `heading` (100% on one pillar) for legacy sessions.

---

### UX Design Notes

**Zero Typing:** A 10-minute round is summarized in a 2-second gesture.

**Higher Accuracy:** Humans are better at spatial estimation ("I was mostly here") than numerical estimation ("I was 72% guard").

**Rich Metadata:** Path "wobble" or "hesitation" can infer user confidence or fatigue during logging. A decisive straight-to-vertex touch reads differently than a wandering path.

**Visual feedback during gesture:** The existing dot, dashed line, and glow ring system in PillarPrism.tsx provides real-time feedback. For Model A, percentage labels near each vertex update live as the user drags. For Model B, render the path trail as a fading line on the SVG.

**Dual-mode behavior (no toggle):** Tapping near a vertex (within 20% of R) snaps to 100% on that pillar — feels like a clean, decisive selection. Only when the dot is in the pentagon's interior do weight percentages appear. Precise loggers ("this was a passing class") never see distributions; spatial loggers ("it was a mix") get full breakdowns. One component, one gesture surface, two natural behaviors. The snap threshold ensures that the "hours per pillar" metric in Analytics remains meaningful: a snapped session contributes all its duration to one pillar (identical to the legacy single-heading behavior), while a distributed session contributes proportionally.

**Phase 1 status (shipped):** IDW weight calculation, snap threshold, live percentage labels, vertex muting, iOS-native animation polish, and DB persistence are all live. `pillar_distribution JSONB` lands on every session via migration 009; analytics reads from it via `sessionPillarHours()` for zero-sum per-pillar hours. Migration 012 adds the canonical position library on top.

---

## Canonical Position Library

**Status:** Shipped (migration 012)
**Files:** `backend_api/migrations/012_canonical_positions.sql`, `backend_api/src/{controllers,models,routes}/canonicalPosition*.ts`, `frontend_app/src/hooks/useCanonicalPositions.ts`, `frontend_app/src/components/TagPicker.tsx`

### Why this exists

Without a controlled vocabulary, users typed the same position different ways on different days — "De La Riva" Monday, "DLR" Tuesday, "de la hiva" by Thursday. Each ended up as a separate `user_tags` row. Aggregate analytics couldn't merge them; the tag library became a junk drawer; autocomplete had nothing useful to suggest.

The fix isn't fuzzy matching — it's a curated reference list. BJJ position vocabulary is finite (~60 named positions cover 99% of what hobbyists log) and well-known. This is the same pattern Letterboxd uses for films, Wikipedia for articles, OpenStreetMap for tags: a curated canonical list with community contributions reviewed before promotion.

### Two-table design

- **`canonical_positions`** — global, read-only to users, ~60 rows seeded by migration 012. Each row carries `name`, `parent_pillar`, and an `aliases TEXT[]` for typeahead. No write endpoints; mutations land via new migrations or future admin tooling.
- **`user_tags`** — existing per-user private vocabulary, unchanged behavior. Migration 012 adds an `aliases` column for parity (so a user could later alias their own custom tag like "Mav's pet sweep" → ["mav sweep", "the thing mav showed me"]).

Sessions reference both via parallel array columns: `user_tag_ids UUID[]` (private) + `canonical_position_ids UUID[]` (shared). Independent. Both can be empty.

### Why custom tags stay user-scoped

When a user types something not in the canonical library — say "Worm Gaurd" (typo) or "Baratoplata" (genuinely new) — the "Add 'X'" fallback creates a row in **their** `user_tags`. Other users never see it. This avoids the moderation tax of crowd-sharing every typed string. A future curator-promotion path lifts popular customs into the canonical library after review.

### TagPicker matching

Substring match, case-insensitive, against name + every alias on both libraries:

```ts
function match(query: string, row: { name: string; aliases: string[] }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (row.name.toLowerCase().includes(q)) return true;
  return row.aliases.some(a => a.toLowerCase().includes(q));
}
```

Canonical results rank first; user customs render with a small "yours" badge. Selection emits two arrays via `onChange(userTagIds, canonicalIds)` so the form sends each to its right column. Typing "DLR" → "De La Riva" appears as the first suggestion → selecting it stores the canonical UUID, not the user's typed string.

Simple substring is good enough for a 60-row library. If it grows 5× a future polish would add Levenshtein scoring.

### Caching

`GET /api/canonical-positions` returns ETag + `Cache-Control: private, max-age=3600`. Frontend `useCanonicalPositions()` hook wraps the fetch in a module-level promise so all components share one network round-trip per page load. The library mutates rarely (migration only) so aggressive caching is safe.

---

## Vertex Muting on PillarPrism

**Status:** Shipped
**Files:** `frontend_app/src/components/PillarPrism.tsx`, `frontend_app/src/index.css`

### Why this exists

A user who trained only Guard + Submissions still produced non-zero IDW weights for Pins, Passing, and Stand-up — the math distributes regardless of intent. Over months, those residuals polluted aggregate analytics: pillar-hours drifted, ACWR saw phantom activity, the Prism looked busier than the user's actual training.

### Gesture model (current)

Earlier iterations tried long-press; users couldn't find it. Final design:

- **Short-tap directly on a vertex's visible dot** (within `VERTEX_TAP_RADIUS = 14` SVG-coord px) toggles its muted state.
- **Drag from anywhere** still places the center dot via IDW (existing behavior).
- **Tap-elsewhere** also places the dot via IDW.

Disambiguation lives in `pointerdown` / `pointermove` / `pointerup` lifecycle:
1. `pointerdown` — record start position + time. If position is within a vertex's hitbox, defer placement (record vertex as `candidateVertex`). Otherwise place dot immediately.
2. `pointermove` — if movement > 4px, revoke the toggle candidacy and start placing the dot.
3. `pointerup` — if still a candidate AND duration < 400ms, fire `tryToggleMute(candidate.value)`. Otherwise no-op (placement already happened during move).

### Math change

`calculateWeights(px, py, active: readonly Vertex[])` accepts an explicit active set. Snap loop and IDW normalisation iterate only over `active`. Muted pillars are absent from the returned dict entirely (not zero-keyed). The backend's existing `sanitizePillarDistribution` already filters zero-weights and renormalises, so no backend change was needed — muted pillars naturally disappear from `pillar_distribution JSONB`.

### Guards

- Can't mute the currently active heading — rejected with a 4ms haptic tick (user must reselect elsewhere first).
- Can't mute down to zero active vertices — same rejection.
- Distinct 60ms haptic on successful toggle (categorically longer than the 6/8/12ms ticks used for placement events).

### Visual feedback

- Muted vertex: no halo, label dims to `rgba(255,255,255,0.22)` with a leading `×` glyph, dashed line ghosts to opacity 0.08, vertex dot becomes a smaller dashed-hollow circle.
- Always-visible vertex dots on every pillar (not just the primary) — small filled copper for active, slightly larger for primary, larger again on snap-in. iOS users without `navigator.vibrate` get full visual confirmation.

---

## Animation Polish Pass — iOS-Native Spring Curves

**Status:** Shipped
**Files:** `frontend_app/src/index.css`, `frontend_app/src/components/PillarPrism.tsx`

### Reference

`project/J2/implementation-plans.md` "Animation Pattern Libraries" calls out [SwiftUI-Animations](https://github.com/Shubham0812/SwiftUI-Animations) as the bar for native-feeling micro-interactions:

> *"Even though J2 is a web PWA, iOS-native animation patterns set the bar for what users expect. Cross-reference when designing new interactions to ensure our CSS/JS animations match the timing, easing, and polish of native equivalents."*

The canonical "iOS spring" curve we use is `cubic-bezier(0.34, 1.56, 0.64, 1)` — close to SwiftUI's `interactiveSpring()`. Same curve is in `lib/spring.ts` and on the placed-dot press release.

### Three keyframes

- **`j2VertexToggle`** (320ms) — vertex dot pumps to 1.35× then settles past 0.92× before landing at 1×. Plays once when `tryToggleMute` succeeds. iOS toggle-switch overshoot feel.
- **`j2VertexSnapIn`** (280ms) — inner ring lands from `scale(1.4) opacity(0)` through `scale(0.92) opacity(1)` to `scale(1) opacity(0.85)`. Plays once when the conditional render mounts on snap entry.
- **`j2VertexDotPump`** (240ms) — vertex dot pumps to 1.4× and settles. Plays once when the dot becomes the snapped primary.

All three use `transform-box: fill-box; transform-origin: center` so the scale pivots around the element's center regardless of SVG position. All three respect `prefers-reduced-motion`.

### State plumbing

React `key` changes drive single-shot keyframe replays:

- `lastToggle: { vertex, instance } | null` — set in `tryToggleMute` after a successful toggle. `useEffect` clears 360ms later so unrelated re-renders don't re-fire.
- `snapInstance: number` — incremented by a `useEffect` watching `[isSnapped, activeVertex?.value]`. `isFirstSnapEffect.current` ref guards the initial render so a `defaultHeading` mount doesn't auto-pump.

The vertex dot's `key` includes `lastToggle.instance` or `snap-${snapInstance}` when relevant; the inner ring's `key` includes `snap-${snapInstance}`. Each new toggle / snap entry forces a fresh remount → keyframe plays once.

### What stayed unchanged after audit

- `j2PrestigeBreathe` (4.2s) — already paced like Apple's ambient idle / celebratory animations.
- `j2IntentCopperPulse` on the active vertex halo — already fits the iOS feel.
- `lib/spring.ts` — canonical curves; no change.

---

## Pretext Integration — Non-Reflow Text Measurement

**Status:** Shipped
**Files:** `frontend_app/src/lib/pretextMeasure.ts`, `frontend_app/src/app/PathAheadPage.tsx`, `frontend_app/src/app/JournalEntryPage.tsx`, `frontend_app/src/index.css`

### Reference

`project/J2/implementation-plans.md` "Performance & Layout Libraries" added [@chenglou/pretext](https://github.com/chenglou/pretext) — pure-JS multiline text measurement and layout that doesn't trigger DOM reflows. Pinned to v0.0.6 (pre-1.0; expect API churn).

### What it gives us

Before rendering, given a text + width + font + line-height, Pretext returns the exact wrapped lines and total height. We use this for:

1. **Reflection card height stability (PathAheadPage)** — pre-measure all 6 rotating prompts at the card's actual content width, lock the prose `<p>` to the tallest height. Card stops jumping height as the daily prompt cycles.
2. **Journal inscribe reveal (JournalEntryPage)** — wrap the saved journal entry into measured lines, render each as a `<span>` with staggered `animation-delay`, then hand off to the textarea. Lines respect actual word-wrap break points so the cadence reads as sentences, not characters. Maps to "the mat remembers every session."

### Wrapper rationale

`lib/pretextMeasure.ts` is a thin façade over `prepareWithSegments` + `layoutWithLines`. It exists for three reasons:

1. **API churn isolation** — Pretext is at v0.0.6. If the API changes, the swap is one file.
2. **Defensive fallback** — try/catch returns `{ lines: [text], height: lineHeight }` if Pretext throws (font not loaded, missing OffscreenCanvas, future API break). Callers always get a sensible result.
3. **Caching** — measurements are deterministic, cached in `Map<string, MeasureResult>` keyed on the full opts hash.

### Inscribe reveal mechanics

- `revealComplete` starts `false` so the textarea is hidden on initial paint (avoids flash of full text before opacity-0 kicks in).
- After `setText(found.journal_entry)`, the measurement effect runs once `journalCardWidth` is known via `ResizeObserver`.
- Stagger formula `min(150, max(40, 2400/lines))` ms — caps total reveal duration at ~2.5s for long entries.
- Per-line keyframe `j2InscribeLine` (opacity 0→1 + 4px translate-up) at 280ms with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-luxury).
- After `lines × stagger + 280 + 200` ms breath, `revealComplete` flips true → overlay fades, textarea cross-fades to interactive over 240ms.
- Skipped for empty entries, `prefers-reduced-motion`, fetch errors, and re-fetches (`textInitialized.current` guard).

---

## Meso-Cycle Snapshots

**Status:** Future exploration (depends on Focus Areas)
**Dependencies:** Focus Areas (Sprint 6), D3 Prism migration

---

### Concept

Users can save a named snapshot of their current focus area config + training period as a periodization cycle (e.g. "Q1 2026 — Guard Recovery Phase"), then start a new cycle with the same or different focus areas. Over time this creates a longitudinal training autobiography. Focus area transitions get a clean boundary instead of orphaned labels.

### What a cycle captures:
- Cycle name (user-defined, e.g. "Competition Prep — Summer 2026")
- Focus area configuration (the 1–5 labels active during this cycle)
- Date range (start → end)
- Aggregated Prism data (hours per area, intention alignment, resonance averages)
- A frozen Prism shape (re-renderable from data)

### User flow:
- From Analytics or Profile, "Save current cycle" → name it → cycle is archived
- Start a new cycle with the same or edited focus areas
- "Cycle History" view: a shelf of past Prisms, each showing the shape, date range, and dominant focus
- Compare any two cycles side-by-side (overlay shapes)

### Data model:

```sql
CREATE TABLE training_cycles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  focus_areas JSONB NOT NULL,        -- snapshot of user's focus areas at cycle time
  start_date  DATE NOT NULL,
  end_date    DATE,                   -- NULL = active cycle
  summary_data JSONB,                -- aggregated hours, traction, resonance per area
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

Sessions belong to a cycle implicitly via date range, not via a foreign key (keeps session logging simple). Current active cycle is the one with no `end_date`.


---

## Web Push (Class-Times Notifications)

Greenfield Web Push pipeline shipping with the class-scheduling feature (Sprint 10). Brand register: editorial, grace-framed, no exclamation points / emoji / "Don't forget!" voice. Refero anchors documented in the Sprint 10 section of [roadmap.md](roadmap.md).

### Architecture

```
[ Class schedule (user-local time) + IANA timezone ]
                       │
                       ▼
   [ node-cron 1-min tick ] ── reads → users.timezone (mig 019)
                       │              + class_schedules (mig 020)
                       ▼
   [ luxon UTC↔local conversion ]
                       │
                       ▼
   [ "fire window" matched? ] ── yes → web-push to all
                       │                push_subscriptions for
                       │                this user, filtered by
                       │                per-category opt-in (mig 021)
                       ▼
   [ Service Worker push handler ]
                       │
                       ▼
   [ self.registration.showNotification() ]
                       │
                       ▼
   [ notificationclick → openWindow(url) ]
```

### Backend pieces

- **`backend_api/src/lib/webPushClient.ts`** — thin wrapper around `web-push` that reads VAPID env vars at boot, exposes `sendPush()`, and reports `expired: true` when the push service returns 410 Gone / 404 Not Found so the scheduler can clean up stale subscriptions.
- **`backend_api/src/lib/notificationScheduler.ts`** — single in-process `cron.schedule('* * * * *', tick)`. Each tick:
  1. Read all active schedules joined with `users.timezone` (one DB hit).
  2. For each schedule, compute the three target instants on today's local day-of-week using `luxon`: `pre_class = start - 30m`, `intention_check = start + duration`, `drive_home_log = start + duration + 8m`.
  3. Compare against the current minute. Fire only when `targetUtcMinute === currentMinute`.
  4. In-memory dedup set keyed by `(schedule_id, kind, fire_iso_minute)` to avoid double-fires within the same minute (e.g. clock skew).
- **Restart resilience:** dedup is in-memory. After a restart we may re-send a ping that already shipped this minute — acceptable for v1; promote to a `notification_sends` ledger if it ever becomes a problem.

### Frontend pieces

- **`vite-plugin-pwa` strategy switch:** `'injectManifest'` so we ship a hand-written `src/sw.ts`. Workbox precaching + runtime caching is preserved (Google Fonts, `/api/*` NetworkFirst, navigation fallback). On top: `push` and `notificationclick` event handlers.
- **`src/lib/pushClient.ts`** — orchestrates the subscribe / unsubscribe / categories flow. Detects iOS standalone-install (`navigator.standalone` + `display-mode: standalone`); when iOS + tab mode, surfaces an install hint instead of attempting `Notification.requestPermission()` (which silently rejects in a tab on iOS Safari).
- **`NotificationPermissionPrimer`** — modal patterned on Headspace + Atoms. Three named category cards with per-category toggles + a mocked iOS notification banner preview that cycles through the active categories. Save triggers permission request → subscribe → POST → category PATCH.
- **`ClassScheduleEditor`** — habit-sentence pattern from Atoms (Refero `665d…f4e1`): "On *Mon Wed Fri* I train *Tue Night BJJ* at *7:00 PM* for *90 min*." Each phrase opens an inline picker. Day picker exposes the three Roots presets ("Every day / Weekdays / Open mat days").

### iOS gotcha (the 16.4+ install requirement)

PWA push only fires when the app is installed via "Add to Home Screen" on iOS 16.4+. From a regular Safari tab, `Notification.requestPermission()` resolves silently with `'default'` and `pushManager.subscribe()` rejects. The primer detects tab mode up-front and shows the install hint copy:

> "iOS only delivers PWA notifications when Journada is installed to your Home Screen. Tap the share icon and choose 'Add to Home Screen' first."

When the iOS Native Foundation sprint (Capacitor + APNs) lands, the schedule + payload structure stays the same — only the delivery layer changes. The same scheduler can fan out to Web Push (other platforms) and APNs (native iOS) by extending `webPushClient` with a sibling `apnsClient`.

### VAPID setup

One-shot script: `backend_api/scripts/generate-vapid-keys.ts`. Run with `npx tsx scripts/generate-vapid-keys.ts`. Paste the output into Railway env vars:

- `VAPID_PUBLIC_KEY` — also exposed via `GET /api/push-subscriptions/vapid-public-key`
- `VAPID_PRIVATE_KEY` — server-only, never commit
- `VAPID_SUBJECT` — `mailto:robertdgelin@gmail.com`

If any of these are missing at boot, `startNotificationScheduler()` logs a warning and **does not start the cron tick** — the API still serves CRUD for class schedules so users can configure schedules without notifications wired up yet.

### Notification copy register

Voice: editorial, grace-framed. Headspace's "meditation takes practice" framing was the calibration anchor (Refero `d3baa0a2-1b5a-4dea-abcc-662392ca9a3a`).

| Kind | Title | Body |
|---|---|---|
| `pre_class` | "{class.name} starts in 30 minutes." | "Carry your {intention.label} focus with you." (or "What will you bring to the mat tonight?" if no active intention) |
| `intention_check` | "How did the round feel?" | "A quick mark on whether you trained your focus." |
| `drive_home_log` | "A few quiet minutes." | "What stayed with you from {class.name}?" |

**Banned:** exclamation points, emoji, "Don't forget!", "Time to crush it!". Anything that smells like a Fitbit or a hustle-culture habit tracker.


---

## First-Time User Onboarding (Sprint 11)

Mobile-first PWA onboarding ships with the class-times notification work (Sprint 10) as the contextually-deferred permission ask. **Goal:** new user reaches their first logged session in under a minute, no tutorial walkthrough, all coachmarks fire in the surface they describe.

### Architecture

```
[ Mobile unauthenticated GET / ]   [ Desktop unauthenticated GET / ]
              │                                  │
              ▼                                  ▼
        /welcome                            LandingPage (existing)
        (Cormorant + Begin pill)
              │
              ▼
        /login?mode=register&from=welcome
              │
   register success ──► /onboarding/name
                              │
                              ▼
                        /onboarding/belt   (skippable)
                              │
                              ▼
                        /onboarding/first-session
                        (LogSessionForm + inline Prism coachmark)
                              │
                              ▼
                        /onboarding/done
                        ("Your first session. Logged.")
                              │
                              ▼
                        markOnboardingComplete()  ──►  /home
```

### Routing guards

`ProtectedShell` wraps every authenticated route. Inside it, `OnboardingGate` checks `profile.onboarding_completed_at`:
- If `null` and the URL doesn't already start with `/onboarding`, redirect to `/onboarding/name`.
- Wait for `loaded` to flip true before deciding — prevents a flash-redirect on cold load while the profile fetch is in flight.

Onboarding pages have their own provider chain (`ProfileProvider` only — no `AppShell`) so they own their own chrome. The pages call `useProfile()` to read existing fields and `markOnboardingComplete()` from `useOnboardingState` on the final step.

### Coachmarks (Refero anchor: Moonly `31b1c0e2-…`)

`useCoachmark(key)` returns `{ isOpen, dismiss }`. On mount, checks `localStorage['coachmark.' + key]`; if set, never opens. Otherwise opens after a 220ms delay (lets the surface paint first). Dismiss writes a timestamp to localStorage so the modal never re-fires on this device.

Four coachmarks, one per surface:
- `coachmark.prism-log` — inline during onboarding step 5. Copy: "Tap a face to mark what you focused on. The shape grows with your sessions." Reflects the brand framing decision: Prism is one of the views, not the stated flagship.
- `coachmark.calendar` — first visit to `/calendar`. "Every session lands here."
- `coachmark.intentions` — first visit to `/intentions`. "Set what you're working on this week."
- `coachmark.classes` — first visit to `/profile/classes`. "Add your weekly schedule."

### Empty-state hero pattern (Refero anchor: ABY `8416de7c-…`)

Three surfaces — Atlas / Journal / Library — were silently rendering empty. Replaced with editorial chapter-title cards (single leather card on the page, Cormorant heading in champagne, italic subhead, copper "Log a session →" CTA where appropriate). Calendar and Intentions get coachmarks instead of empty heroes since the empty state is itself meaningful (you can tap dates to log sessions in calendar, you can set an intention even with no sessions).

### Editorial copy register

Voice anchor: Headspace's "meditation takes practice" framing (Refero `d3baa0a2-…`). Banned: exclamation points, emojis, "Don't forget!", "Time to crush it!", anything that calls the Prism the centerpiece. The product is "an app to help you track your jiu-jitsu — we'll build your training record over time."

Final-screen takeover (Refero anchor: Alive `80e90b55-…`): "Your first session. Logged." in champagne Cormorant, italic "We'll keep your training record from here." subhead, single fade-in animation.

### iOS PWA gotcha

Web Push only fires when the PWA is installed via "Add to Home Screen" on iOS 16.4+. The `OnboardingDonePage` checks `isStandaloneInstall()` and only surfaces the notification primer when running standalone. In Safari tab mode it skips that step entirely — user lands on `/home` with no failure.

### Data model & API

- `users.onboarding_completed_at TIMESTAMPTZ` (mig 022) — NULL = needs onboarding. Pre-existing users backfilled to `NOW()` so they don't get force-routed.
- `POST /api/profile/onboarding-complete` — idempotent; flips the timestamp to `NOW()`.
- Frontend `useOnboardingState` hook surfaces `needsOnboarding` boolean + `markComplete()`. Wraps the POST + a profile refresh so the gate flips immediately.

### Future drop-off mitigations (deferred to backlog)

If onboarding drop-off > 25% post-launch, two levers exist:
1. **Account-deferred sign-up** (ABY Journal pattern). Let users log their first session before account creation; back the anonymous user with IndexedDB; swap in a real account on first save. Bigger lift but biggest known drop-off lever for journaling apps.
2. **Magic-link auth** — replace email + password with magic-link send. Lower friction; adds an email-delivery dependency.

Both documented in [roadmap.md](roadmap.md#future--backlog).

---

## Auto-context capture in support cases (mig 023)

The admin dashboard's case queue is fed by a "Report a Problem" modal on
the profile page. The unique pattern here — and the reason it's worth
documenting in this file — is **the user types two fields, the form
silently captures three more.**

### What the user types
- `subject` (single line, ≤200 chars)
- `description` (multi-line, ≤5000 chars)

### What the client auto-attaches at submit time
- `page_url`     — `window.location.href` (the route they were on when they hit "Report a problem")
- `user_agent`   — `navigator.userAgent` (browser/OS)
- `app_version`  — `import.meta.env.VITE_APP_VERSION` (build hash if available; falls back to `'dev'`)

### Why this matters
Most "report a bug" flows make the user type their browser version,
device, what page they were on, etc. Users either skip those fields
(unhelpful reports) or feel burdened (low conversion).

By auto-attaching the debug context server-side from request-time
client globals, the admin gets full triage info from a 2-field form.
The user types twice, the admin learns five things.

### Privacy note
`user_agent` and `page_url` carry mild PII (browser fingerprint, route
the user was on). They live in the `support_cases` table, readable only
via `/api/admin/cases` (gated by `requireAdmin`). They are never
surfaced to non-admin users — only the admin dashboard renders them.

### Schema
See [database.md](database.md#support_cases-mig-023) for the full table.

### Pattern recipe (for future copies)
```typescript
// Client: silently capture context at submit time
await api.post('/api/cases', {
  subject:     subject.trim(),
  description: description.trim(),
  page_url:    typeof window !== 'undefined' ? window.location.href : null,
  user_agent:  typeof navigator !== 'undefined' ? navigator.userAgent : null,
  app_version: (import.meta as { env?: { VITE_APP_VERSION?: string } }).env?.VITE_APP_VERSION ?? 'dev',
});
```

The same pattern can be reused if we ever add a "send feedback" surface,
in-app chat, error boundary auto-reports, etc. — keep the user typing
the smallest amount and let the client do the contextual archaeology.

### Single-admin auth model
Related but separate decision: `users.is_admin BOOLEAN DEFAULT false`
gates the `/admin` route + `/api/admin/*` endpoints. There is **no API
to set this column** — admin grant is a direct database `UPDATE`. For a
solo SaaS this is simpler than a roles/permissions table; revisit if/when
multi-admin or role hierarchy becomes a real need.
