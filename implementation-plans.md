# Implementation Plans

Detailed implementation plans for roadmap objectives. Each entry captures the design rationale, approach, and key decisions so the thought process is preserved when work begins.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## `[ ]` Animation Quality — Compositor-Safe Refactor

### Problem

A full animation audit of the codebase identified five issues that cause visible
choppiness or unnecessary CPU/GPU work. The root cause in each case is the same:
animating properties that trigger layout recalculation or paint operations instead
of using the four compositor-safe properties (`transform`, `opacity`, `filter`,
`will-change`). The most visible symptom is the Venetian Blind in `BeltDateBanner`
— 9 independently-springing 3D elements whose pixel boundaries create visible seams.

### The Golden Rules (reference for all future animation work)

These are the principles that separate polished from choppy:

1. **Animate one object as one element.** A belt is one piece of fabric. A card is
   one surface. Never split a single visual object into N separately-animated pieces
   with independent spring phases — the physics won't be in sync and seams will show.

2. **Compositor-safe properties only: `transform` + `opacity`.**
   These run on the GPU compositor thread with zero layout or paint cost.
   Properties that fail this test and must be avoided in animations:
   - `width`, `height`, `top`, `left`, `right`, `bottom` → use `transform: scaleX/Y` or `translate`
   - `background-color`, `border-color`, `color` → use `opacity` on a colored overlay
   - `background-position` → use `transform: translateX` on a pseudo-element
   - `box-shadow` changes → acceptable if rare, but avoid animating every frame
   - `clip-path` → compositor-safe in Chrome 112+/Safari 16+ with `will-change: clip-path`

3. **Elastic/spring easing is for single elements.** Applied to a staggered group,
   each element bounces at a different phase — the result is visual chaos rather
   than elegance. Use `power2.out` or `expo.out` for staggered groups; reserve
   `elastic.out` or `back.out` for single elements that need physical snap.

4. **Entry vs. exit easing direction matters.**
   - Entry: ease-out (fast start → decelerates to rest) — the element arrives with energy
   - Exit: ease-in (slow start → accelerates away) — the element "launches" rather than vanishing
   - Never ease-in on entry or ease-out on exit — both read as sluggish

5. **Duration targets for UI interactions:**
   - Micro (tap feedback, tooltip): 80–150ms
   - UI state change (panel swap, toggle): 200–320ms
   - Dramatic reveal (modal open, belt unfurl): 400–700ms
   - Anything over 700ms must feel cinematic or it's just slow

6. **When to use GSAP vs Framer Motion vs CSS:**
   - **CSS keyframes / Tailwind**: stateless, looping, or hover animations that don't
     depend on React state. Shimmer, pulse, particle rise, page transitions.
   - **GSAP**: complex multi-element timelines, scroll-triggered effects, SVG morphing.
     Use `gsap.timeline()` with `gsap.set()` for initial state; always call `tl.kill()`
     in `useEffect` teardown.
   - **Framer Motion** (not yet installed): React-lifecycle-aware animations — mount/unmount
     sequences, shared element transitions (`layoutId`), gesture handling. Better than
     manual GSAP refs for conditional renders and `AnimatePresence`. Consider adding
     if animation scope grows (≈30KB gzipped, similar to GSAP).

---

### Fix 1 — BeltDateBanner: Replace 9-slat Venetian Blind with single-element reveal

**File**: `frontend_app/src/components/BeltDateBanner.tsx`

**Root cause**: 9 separate `<div>` elements each perform `rotateX(-90° → 0°)` with a
40ms stagger and `elastic.out(1, 0.65)`. Each element has its own compositing layer.
Adjacent slats are at different `rotateX` angles simultaneously; the pixel boundary
between them creates a visible seam. The elastic easing means each slat bounces
independently — a wave of chaos rather than one landing.

**Fix**: Collapse to **two** elements — one belt body div, one patch div.
Animate the belt body with `scaleX(0 → 1)` from `transform-origin: left center`.

```tsx
// Replace the 9-slat array with a single belt body div:
<div
  ref={beltRef}
  style={{
    position: 'absolute',
    top: 0, bottom: 0,
    left: 0,
    right: PATCH_W,
    background: ribbed(beltColor),
    boxShadow: SLAT_INSET_SHADOW,
    transformOrigin: 'left center',
    // scaleX(0) set by gsap.set() on mount — no flash
  }}
/>
```

```typescript
// GSAP timeline — useEffect:
gsap.set(beltRef.current, { scaleX: 0 });
gsap.set(patchRef.current, { scale: 0.6, opacity: 0 });
gsap.set(textRef.current,  { opacity: 0 });

const tl = gsap.timeline({ delay: 0.04 });

// 1. Belt body sweeps out left → right (scaleX is compositor-only)
tl.to(beltRef.current, {
  scaleX:   1,
  duration: 0.52,
  ease:     'expo.out',   // Fast start, smooth deceleration — NO elastic
});

// 2. Optional landing pulse: slight vertical squeeze at the moment of arrival
//    gives physical "smack" feel without any seams
tl.to(beltRef.current, {
  scaleY:   0.93,
  duration: 0.07,
  ease:     'power2.in',
  yoyo:     true,
  repeat:   1,
  transformOrigin: 'center center',
}, '-=0.08');

// 3. Patch pops in with back.out snap
tl.to(patchRef.current, {
  scale:    1,
  opacity:  1,
  duration: 0.28,
  ease:     'back.out(2)',
}, '-=0.14');

// 4. Text fades in
tl.to(textRef.current, {
  opacity:  1,
  duration: 0.22,
  ease:     'power2.out',
}, '<0.06');
```

Remove: `SLICES = 9`, `STAGGER_S`, `SLAT_DURATION_S`, the `slatsRef` array,
the `Array.from({length: SLICES})` render, `perspective: 500px` on wrapper.
The parent no longer needs `perspective` since no 3D transform is used.

**Result**: 2 compositing layers instead of 10. Zero seams. Same emotional beat
(belt materializes left-to-right then snaps into place).

---

### Fix 2 — BeltBar tails: `height` → `scaleY`

**File**: `frontend_app/src/components/BeltBar.tsx`

**Root cause**: `j2TailL` and `j2TailR` keyframes animate `height` from `0` to the
tail's target height. CSS `height` changes trigger a full layout recalculation on
every frame — the browser must reflow the document to determine how tall the element
is at each animation step.

**Fix**: Set `height` to its final value in the element's static styles. Animate
`scaleY(0 → 1)` from `transform-origin: top center` instead.

```css
/* Before — animates height (layout): */
@keyframes j2TailL {
  0%   { height: 0;              rotate: -22deg; }
  60%  { height: calc(var(--th) * 1.09); rotate: 6deg; }
  100% { height: var(--th);      rotate: 0deg; }
}

/* After — animates scaleY (compositor): */
@keyframes j2TailL {
  0%   { transform: scaleY(0)    rotate(-22deg); }
  60%  { transform: scaleY(1.09) rotate(6deg); }
  100% { transform: scaleY(1)    rotate(0deg); }
}
```

The tail `<div>` gets `transform-origin: top center` and its final `height` set
statically via the `--th` CSS custom property. Same visual, zero layout recalc.

Note: The combined `transform` shorthand (scaleY + rotate) requires careful ordering
in CSS (`scaleY` first, then `rotate`, since transforms apply right-to-left). Test
the pendulum swing angle in both left and right tail variants.

---

### Fix 3 — Shimmer: `backgroundPosition` → `translateX` on pseudo-element

**File**: `frontend_app/tailwind.config.ts`

**Root cause**: `j2-shimmer` animates `background-position` across a gradient,
which is a paint operation — the browser re-rasterizes the background texture each
frame.

**Fix**: Replace with a `translateX` sweep on a `::before` pseudo-element that
carries a fixed gradient. The element itself has `overflow: hidden`.

```typescript
// tailwind.config.ts — replace j2-shimmer keyframes:
'j2-shimmer': {
  '0%':   { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(200%)' },
},

// The skeleton element uses:
// position: relative; overflow: hidden;
// ::before { content: ''; position: absolute; inset: 0;
//   background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
//   animation: j2-shimmer 1.2s ease-out infinite; }
```

Because the animation is now `transform: translateX`, it runs entirely on the
compositor thread with no per-frame paint. In practice this means smoother shimmer
on low-end Android devices.

---

### Fix 4 — Today-pulse: remove `borderColor` animation

**File**: `frontend_app/tailwind.config.ts`

**Root cause**: `j2-today-pulse` alternates `border-color` between two values on a
4s loop. Color changes on border require the browser to repaint the element's border
every frame.

**Fix**: Remove the `border-color` keyframe steps. Keep only the `box-shadow` pulse.
Add a static border color on the element itself (not animated).

```typescript
// Before:
'j2-today-pulse': {
  '0%, 100%': { borderColor: '#C4915F', boxShadow: '...' },
  '50%':      { borderColor: 'rgba(196,145,95,0.30)', boxShadow: '...' },
},

// After:
'j2-today-pulse': {
  '0%, 100%': { boxShadow: '0 0 0 1px rgba(196,145,95,0.80), 0 0 6px rgba(196,145,95,0.40)' },
  '50%':      { boxShadow: '0 0 0 1px rgba(196,145,95,0.30), 0 0 2px rgba(196,145,95,0.15)' },
},
// Static class: border: 1px solid rgba(196,145,95,0.80)
// The border is always visible; only the glow pulses.
```

Note: `box-shadow` is technically also a paint operation. This fix reduces repaint
area (border-color affects 4 edges; box-shadow is composited by some browsers via
the compositor's shadow pass). If further optimization is needed, replace the shadow
pulse with an `opacity` pulse on a `::after` pseudo-element.

---

### Fix 5 — Centralize particle / intention keyframes

**Files**: `SessionDetailModal.tsx`, `DayCard.tsx`, `TrainingHeatmap.tsx`,
`PathAheadPage.tsx`, `tailwind.config.ts`

**Root cause**: `j2IntentParticleRise`, `j2IntentYellowPulse`, `j2IntentPurplePulse`
are copy-pasted into `<style>` tags in four separate component files. Any change must
be made four times, and the duplication inflates CSS payload.

**Fix**: Move all three keyframe definitions to `tailwind.config.ts` and expose as
utility classes. Remove the `<style>` tag declarations from all four component files.

```typescript
// tailwind.config.ts — add to keyframes:
'j2-intent-particle-rise': {
  '0%':   { transform: 'translateY(0) translateX(var(--drift))', opacity: '0' },
  '20%':  { opacity: '1' },
  '100%': { transform: 'translateY(-52px) translateX(var(--drift))', opacity: '0' },
},
'j2-intent-yellow-pulse': {
  '0%, 100%': { opacity: '0.40', transform: 'scaleX(1)' },
  '50%':      { opacity: '0.70', transform: 'scaleX(1.03)' },
},
'j2-intent-purple-pulse': {
  '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
  '50%':      { opacity: '0.65', transform: 'scale(1.08)' },
},

// animation utilities:
'animate-j2-intent-particle': 'j2-intent-particle-rise var(--dur, 4s) ease-in-out infinite',
'animate-j2-intent-yellow-pulse': 'j2-intent-yellow-pulse 3.1s ease-in-out infinite',
'animate-j2-intent-purple-pulse': 'j2-intent-purple-pulse 4.2s ease-in-out infinite',
```

Replace each inline `animation:` style with the corresponding Tailwind class.
`--dur` and `--drift` custom properties are still set as inline styles on the
individual particle elements.

---

### Broader "Next Level" Path (future consideration)

**Framer Motion** (≈30KB gzipped) would replace manual `useEffect`/`useRef` GSAP
wiring for React-lifecycle-bound animations:

- `AnimatePresence` handles mount/unmount sequences cleanly (modal open/close,
  conditional panel rendering) without needing `gsap.set()` + `tl.kill()` teardown
- `motion.div` with `layout` prop animates element repositioning automatically
  (e.g. belt rank change causing layout shifts)
- `layoutId` enables shared-element transitions between routes
- `whileHover` / `whileTap` replace CSS `:hover` transitions for complex effects

**When to add it**: When two or more of these needs arise — right now GSAP covers
the complexity, and Framer Motion would add bundle weight without payoff. The fix
candidates above do not require it.

**Lottie** (pre-baked After Effects exports) is worth considering for static
animations that don't react to runtime data — loading screens, empty states,
milestone celebration moments. Not useful for anything that depends on belt rank,
session data, or user state.

---

### Verification

Each fix can be validated independently:

| Fix | How to verify |
|---|---|
| Belt reveal | Load LogSessionForm — belt materializes left-to-right with no visible panel seams. Chrome DevTools → Performance → record 2s — check no layout or paint events during the animation. |
| BeltBar tails | Profile page → belt tying sequence → Performance tab → confirm no layout in the tail-drop phase (was `height` change). |
| Shimmer | Any skeleton loading state → Performance → confirm shimmer frames are compositor-only (green bars, no yellow paint). |
| Today-pulse | Calendar page → Performance → inspect today's cell — only box-shadow recalc, no border repaints. |
| Particle keyframes | Search codebase for `j2IntentParticleRise` — should appear only in `tailwind.config.ts`, zero `<style>` tags. |

---

## `[ ]` In-App Admin / Troubleshooting View

### Problem

Debugging production issues currently requires opening Railway logs + the Supabase SQL editor to answer questions like "did that migration run?" or "what was the real error?" The catch-all error handler in `app.ts` discards the actual DB error and returns a generic "Server error" to the client, which makes issues very hard to diagnose from the browser alone.

### Approach: In-App View (not an external monitoring service)

External monitoring (Sentry, Datadog) earns its keep when *other people's errors* happen without you watching. For a single-developer app where you're also the primary user, an in-app view has higher leverage: you can check data state, migration status, and error details without leaving the app.

External monitoring can be dropped in later (one-file Sentry SDK install) if there are real users to watch.

### Three Panels

| Panel | What it shows |
|-------|---------------|
| **Health** | DB connection + presence/absence of every expected column in `training_sessions` — the migration-status check we needed when `resonance` was missing |
| **Error Log** | Last 20 server errors in memory: timestamp, route, method, message, stack. No DB write, no external service |
| **Users** | All registered users with session/intention counts; row click shows recent sessions |

### Admin Authentication

No DB column or migration needed. Check: `req.user.email === process.env.ADMIN_EMAIL`.

- Set `ADMIN_EMAIL=you@example.com` in Railway backend env vars
- All admin endpoints 403 if check fails
- Frontend: decode the JWT payload (base64, not encrypted) to read the user's email client-side; gate the `/admin` route without an extra API call

### Files to Change

| File | Change |
|------|--------|
| `backend_api/src/lib/errorLog.ts` | **New** — in-memory ring buffer. `recordError(method, route, err)` + `getRecentErrors()`. Max 20 entries. |
| `backend_api/src/app.ts` | Wire catch-all error handler to call `recordError()`. Also expose the actual `err.message` in the 500 response body (not just "Server error"). |
| `backend_api/src/middleware/adminMiddleware.ts` | **New** — `requireAdmin` middleware, checks email against `ADMIN_EMAIL` env var |
| `backend_api/src/routes/adminRoutes.ts` | **New** — `GET /api/admin/health`, `GET /api/admin/errors`, `GET /api/admin/users` |
| `backend_api/src/controllers/adminController.ts` | **New** — handlers for the 3 admin endpoints |
| `frontend_app/src/context/AuthContext.tsx` | Decode JWT payload to expose `userEmail: string \| null` from context |
| `frontend_app/src/app/AdminPage.tsx` | **New** — three-tab UI, gated to admin email |
| Frontend router | Add `/admin` route, redirect non-admin to `/` |

### Key Implementation Notes

**Error log module** (`src/lib/errorLog.ts`):
```typescript
interface ErrorEntry { ts: string; method: string; route: string; message: string; stack?: string; }
const log: ErrorEntry[] = [];
export function recordError(method: string, route: string, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  log.unshift({ ts: new Date().toISOString(), method, route, message: e.message, stack: e.stack });
  if (log.length > 20) log.pop();
}
export function getRecentErrors() { return [...log]; }
```

**Health check** — `GET /api/admin/health` — runs `information_schema.columns` query against `training_sessions`, returns each expected column as `{ name, exists }`. Expected columns (15): `id, user_id, date, duration, gi_nogi, intensity, session_type, notes, tags, heading, polarity, sub_skill_tag, script_source, resonance, created_at`.

**Users query** — single SQL with LEFT JOINs to `training_sessions` and `intentions`, grouped by user, returns `session_count` and `intention_count`.

**JWT decode on frontend**:
```typescript
function decodeJwtEmail(token: string): string | null {
  try { return JSON.parse(atob(token.split('.')[1])).email ?? null; }
  catch { return null; }
}
```

### Verification

1. Set `ADMIN_EMAIL` + `VITE_ADMIN_EMAIL` env vars, redeploy
2. Navigate to `/admin` as admin — all three tabs render
3. Health tab: any missing column shows red ✗; add it in Supabase, refresh → green ✓
4. Trigger a 500, check it appears in Errors tab with the real message
5. Non-admin user: `/admin` redirects to `/`
6. `cd backend_api && npm test` — all 42 pass + new tests for admin 403/200

---

## Design & Animation Reference Resources

Curated tools and repositories used for market research, competitive analysis, and animation pattern reference when making design decisions.

### Animation Pattern Libraries

| Resource | URL | What it is | How we use it |
|----------|-----|------------|---------------|
| **SwiftUI-Animations** | [github.com/Shubham0812/SwiftUI-Animations](https://github.com/Shubham0812/SwiftUI-Animations) | 2.8k-star open-source collection of 20+ polished SwiftUI animation components — loaders, interactive buttons, toggles, card transitions, Metal shader effects. Each animation is self-contained and production-ready. iOS 17+, Swift 5+. Includes haptic feedback patterns. | Reference for native-feeling micro-interactions: button press states, loading indicators, toggle animations, card reveals. Even though J2 is a web PWA, iOS-native animation patterns set the bar for what users expect. Cross-reference when designing new interactions to ensure our CSS/JS animations match the timing, easing, and polish of native equivalents. Particularly useful for: submit button states, loader choreography, toggle switch physics. |

### Performance & Layout Libraries

| Resource | URL | What it is | How we use it |
|----------|-----|------------|---------------|
| **Pretext** | [github.com/chenglou/pretext](https://github.com/chenglou/pretext) | 45k-star pure TypeScript library for measuring and laying out multiline text without triggering DOM reflows. Implements its own text measurement using the browser font engine — avoids `getBoundingClientRect`/`offsetHeight` which cause expensive layout recalculation. Supports CJK, Arabic, emoji, mixed-script. Works across DOM, Canvas, SVG, and SSR. MIT license. | Relevant for any future text-heavy features (notes search result previews, journal entries, drill descriptions) where we need to measure/truncate text without causing reflow. Also a reference for the philosophy of separating one-time preparation from cheap layout calculations — the same pattern our animation system uses (prepare compositor layers once, animate only transform/opacity). Potential direct integration if we add virtualized session lists or text-wrapping-aware truncation. |

### Design Research & Competitive Analysis

| Resource | URL | What it is | How we use it |
|----------|-----|------------|---------------|
| **Refero** | [refero.design](https://refero.design) | Curated library of real product screenshots and UI flows from shipping apps. Searchable by app, screen type, and pattern. | Competitive benchmarking — search for "fitness tracker", "training log", "dashboard" patterns to see how flagship apps handle specific flows. Used for homepage layout decisions, navigation patterns, and information architecture. |
| **Mobbin** | [mobbin.com](https://mobbin.com) | Extensive mobile app design pattern library with screenshot flows from 300+ apps. Filterable by screen type, industry, and UI pattern. | Similar to Refero but with deeper flow-level analysis. Used for onboarding, settings, and data visualization pattern research. |
| **Dribbble** | [dribbble.com](https://dribbble.com) | Design community with concept work and polished UI mockups. | Inspiration source, but with caution — Dribbble concepts often prioritize visual impact over usability. Our audit philosophy: "if it ships in a real product, study it; if it's Dribbble-only, question whether it works at scale." |
