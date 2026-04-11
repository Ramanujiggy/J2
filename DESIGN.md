# Journada — Design System

Journada is a BJJ training tracker built as a mobile-first dark-theme PWA. The
aesthetic is **deep forest night**: rich forest-green surfaces, warm copper
borders, champagne-gold titles, and burnt-orange accents. Every surface feels
like aged leather and dark wood — measured, confident, grounded.

Tell your AI agent: *"Build a page that looks like the Journada design system"*
and reference the sections below for pixel-perfect consistency.

---

## 1. Visual Theme & Atmosphere

**Mood:** Martial-arts dojo at night. Dark, focused, purposeful. No playful
gradients, no neon. The background is not black — it's a deep forest green
(`#0D1A14`) that reads warm in context. Cards float above it as slightly
lighter green surfaces (`#152E22`).

**Key characteristics:**
- Dark-forest-native: everything lives on `#0D1A14`; cards raise to `#152E22`
- Two typefaces: **Inter** (sans UI) and **DM Serif Display** (decorative headers only)
- The only "bright" color is a champagne gold (`#F2E4A8`) reserved for titles and nav labels
- Warm copper (`#C4915F`) handles all borders, rails, and accents — never blue or cool-toned borders
- The active/CTA color is burnt orange (`#DA7422`) — punchy, not neon
- Glows are yellow-warm halos on titles (`text-shadow` using the `#F2E4A8` palette) — never blue or white glow
- Touch-first: minimum 44px tap targets, `touch-action: manipulation` on all buttons
- Mobile nav is a bottom tab bar; desktop gets a left sidebar rail

**Atmosphere words:** grounded, earned, night-time dojo, aged leather, precision.

---

## 2. Color Palette & Roles

### Background Surfaces

| Token | Value | Use |
|-------|-------|-----|
| `PAGE_BG` | `#0D1A14` | Page background — every page |
| `CARD_BG` | `#152E22` | Raised card / component surface |
| `HEATMAP_REST` | `#0A1610` | Empty heatmap cell (darker than page) |
| `HEATMAP_FUTURE` | `#08120D` | Future days on heatmap (no session) |
| `HEATMAP_HEADER_BG` | `#111D16` | Sticky calendar column header |
| Modal backdrop | `rgba(13,26,20,0.85)` | Overlay behind all modals |

### Accent & Brand

| Token | Value | Use |
|-------|-------|-----|
| `PALE_YELLOW` | `#F2E4A8` | All page titles, nav active labels, stat numbers |
| `COPPER` | `#C4915F` | Card borders, wave SVG arcs, decorative strokes |
| `COPPER_BORDER` | `rgba(196,145,95,0.45)` | Standard card border (45% opacity) |
| `brand.orange` | `#DA7422` | Active button state, CTA, selected pill |
| `brand.green` | `#6FD08C` | Success, Gi tag, high-intensity heatmap cell |
| `brand.light-green` | `#CDDFA0` | Light / easy intensity cells |
| `brand.dark` | `#0D1A14` | Same as PAGE_BG — Tailwind alias |

### Intention Category Colors

Used on category badges (text + `20` opacity background):

| Category | Color |
|----------|-------|
| technical | `#60a5fa` (blue) |
| physical | `#f87171` (red) |
| mental | `#a78bfa` (violet) |
| positional | `#34d399` (emerald) |
| competitive | `#fbbf24` (amber) |

### Intensity / Heatmap Scale

| Intensity | Color | Label |
|-----------|-------|-------|
| None / rest | `#0A1610` | — |
| 1–2 | `#CDDFA0` | Very Light / Light |
| 3 | `#6FD08C` | Moderate |
| 4–5 | `#DA7422` | Hard / Max Effort |

### Text Scale

| Role | Value |
|------|-------|
| Primary title | `#F2E4A8` (PALE_YELLOW) |
| Body text | `rgba(255,255,255,0.80)` |
| Secondary / labels | `rgba(255,255,255,0.60)` |
| Muted / metadata | `rgba(255,255,255,0.35)` |
| Placeholder | `rgba(255,255,255,0.20)` |
| Disabled / ghost | `rgba(255,255,255,0.15)` |

### Status / Feedback

| State | Color |
|-------|-------|
| Error | `#f87171` (red-400) |
| Success toast | `brand.orange` `#DA7422` |
| Offline warning | amber / `rgba(251,191,36,…)` |

---

## 3. Typography Rules

### Font Families

```css
font-family: 'Inter', system-ui, sans-serif;          /* all UI */
font-family: 'DM Serif Display', serif;               /* decorative hero headings only */
```

Inter is the workhorse for all body text, labels, buttons, and navigation.
DM Serif Display appears only on the app name / wordmark contexts.

### Hierarchy

| Role | Size | Weight | Color | Notes |
|------|------|--------|-------|-------|
| Page title (h2) | 24px (`text-2xl`) | 700 (`font-bold`) | `PALE_YELLOW` | + `GLOW_SOFT` text-shadow |
| Section header | 18px | 600 | `rgba(255,255,255,0.80)` | |
| Card title | 16px | 600 | `rgba(255,255,255,0.90)` | |
| Body / description | 14–15px | 400 | `rgba(255,255,255,0.80)` | `leading-relaxed` |
| Label / uppercase chip | 11px | 500 | `rgba(255,255,255,0.25–0.35)` | `uppercase tracking-wide` |
| Stat number (hero) | 32px+ | 700 | `PALE_YELLOW` | + `GLOW_SOFT` |
| Button | 14px (`text-sm`) | 500 (`font-medium`) | white | |
| Input | 14–16px | 400 | white | |
| Monospace / code | 13px | 400 | `rgba(255,255,255,0.60)` | system monospace |

### Tracking

- Page titles: `tracking-tight` (default, no extreme negative spacing)
- Uppercase chip labels: `tracking-wide` (0.05–0.08em)
- All other text: default tracking

---

## 4. Component Stylings

### Buttons

**Active / Primary (CTA)**
```
background: #DA7422  (brand.orange)
text: white
padding: 8px 16px  (py-2 px-4)
border-radius: 8px  (rounded-lg)
font: 14px / 500
hover: rgba(218,116,34,0.90)
disabled: opacity-50
```

**Inactive / Secondary**
```
background: rgba(255,255,255,0.10)
text: rgba(255,255,255,0.60)
padding: 8px 16px
border-radius: 8px
hover: rgba(255,255,255,0.20)
```

**Destructive / Danger**
```
background: rgba(248,113,113,0.15)
text: #f87171
border: 1px solid rgba(248,113,113,0.30)
border-radius: 8px
```

**Ghost / Text-only**
```
background: transparent
text: rgba(255,255,255,0.50)
hover: rgba(255,255,255,0.80)
padding: 10px 16px
```

**Pill / Toggle (time range, view tabs)**
```
Active:   background rgba(218,116,34,0.80), text white, border-radius 6px
Inactive: background transparent, text rgba(255,255,255,0.50), border-radius 6px
```

### Cards

```
background: #152E22  (CARD_BG)
border: 1px solid rgba(196,145,95,0.45)  (COPPER_BORDER)
border-radius: 16px  (rounded-2xl)
box-shadow: 0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)
padding: 20px  (p-5) or 24px (p-6)
```

Card surface variant (subtle rim-light):
```
background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 20%), #152E22
```

### Inputs & Textareas

```
background: rgba(255,255,255,0.10)
border: 1px solid rgba(255,255,255,0.10)
border-radius: 8px  (rounded-lg)
padding: 10px 16px  (py-2.5 px-4)
text: white
placeholder: rgba(255,255,255,0.30)
focus ring: 2px solid #DA7422  (ring-brand-orange)
```

Date input: same pattern; calendar picker inherits browser style on mobile.

### Modals / Dialogs

```
Backdrop:
  position: fixed inset-0
  background: rgba(13,26,20,0.85)
  backdrop-filter: blur(12px) saturate(1.2)
  z-index: 50 (60 for CsvImport)
  display: flex, align-items: flex-start, justify-content: center
  overflow-y: auto
  padding-top: max(1rem, env(safe-area-inset-top))
  padding-bottom: max(1rem, env(safe-area-inset-bottom))
  animation: j2-backdrop-in 250ms ease

Modal box:
  background: #152E22
  border: 1px solid rgba(196,145,95,0.45)
  border-radius: 16px
  max-width: 28rem (sm) / 42rem (lg / CsvImport)
  width: 100%
  max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)
  overflow-y: auto
  padding: 24px
  animation: j2-modal-in 400ms cubic-bezier(0.16,1,0.3,1) 80ms both
```

### Navigation

**Mobile — bottom tab bar**
```
position: fixed bottom-0
background: rgba(13,26,20,0.92) + backdrop-blur
border-top: 1px solid rgba(196,145,95,0.15)
padding-bottom: env(safe-area-inset-bottom)
5 tabs: Home, Calendar, Analytics, Intentions, Profile
Active tab: icon + label in #F2E4A8 with GLOW_NAV text-shadow
Inactive tab: rgba(255,255,255,0.40) / no glow
```

**Desktop — left sidebar rail**
```
width: 240px
background: #0D1A14 (same as page)
border-right: 1px solid rgba(196,145,95,0.15)
Nav links: 14px, PALE_YELLOW when active + GLOW_NAV
```

### Badges / Category Pills

```
background: {categoryColor}20  (color at 12.5% opacity)
color: {categoryColor}
padding: 2px 6px
border-radius: 9999px  (rounded-full)
font: 10px / 500 / capitalize
```

### Skill Tag Buttons (multi-select)

Same as Active / Inactive button pattern. `flex-wrap` container so they wrap
naturally on narrow mobile widths.

### Heatmap Cells

```
border-radius: 3–4px
min-height: 14px (mobile) / 16px (desktop)
transition: opacity 200ms
Color: see Intensity scale above
Today: pulsing copper border (j2-today-pulse animation)
```

### Loading / Skeleton

```
background: rgba(255,255,255,0.05)
border-radius: 8px
animation: j2-shimmer 1.2s ease-out  (shimmer sweep)
```

---

## 5. Layout Principles

### Spacing

Base unit: **4px**. Common values:

| Tailwind | px | Use |
|----------|----|-----|
| `gap-1` | 4 | Tight icon clusters |
| `gap-2` | 8 | Button groups, tag rows |
| `gap-3` | 12 | List item spacing |
| `gap-4` | 16 | Section spacing within cards |
| `gap-5` | 20 | Between major card sections |
| `gap-6` | 24 | Between page cards |
| `p-4` | 16 | Card padding (compact) |
| `p-5` | 20 | Card padding (standard) |
| `p-6` | 24 | Card padding (roomy) |
| `py-6` | 24 | Page vertical padding |

### Grid & Containers

- Page max-width: `max-w-2xl` (672px) centered, `px-4 sm:px-6`
- Analytics / wide views: `max-w-4xl` (896px)
- Card-in-card: `space-y-4` or `space-y-5`
- Two-column form fields: `flex flex-col sm:flex-row gap-4`

### Whitespace Philosophy

The deep green page background IS the whitespace. Cards should not be packed
edge-to-edge — allow `gap-4` to `gap-6` between cards so the page bg breathes
through. Never use white space as separation; use the dark forest as breathing room.

### Border Radius Scale

| Size | Value | Use |
|------|-------|-----|
| Micro | 3–4px | Heatmap cells |
| Small | 6px (`rounded`) | Pill toggle states, small badges |
| Standard | 8px (`rounded-lg`) | Buttons, inputs, small cards |
| Card | 16px (`rounded-2xl`) | All cards and modals |
| Full pill | 9999px (`rounded-full`) | Category badges, filter chips |

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Base (L0) | `#0D1A14`, no shadow | Page background |
| Surface (L1) | `#152E22` + `COPPER_BORDER` | Cards, panels, modals |
| Raised (L2) | L1 + `CARD_SHADOW` | Featured cards, active modals |
| Rim-lit (L2+) | `CARD_SURFACE` gradient + shadow | Hero cards, belt bar |
| Overlay (L3) | `rgba(13,26,20,0.85)` backdrop + blur | Modal backdrops |
| Today highlight | Pulsing `COPPER_BORDER` + glow | Calendar today cell |

**Shadow philosophy:** Green-on-green surfaces rely on the copper border for
separation, not shadow. `CARD_SHADOW` (`0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)`)
is layered for depth — the spread shadow reads as a gradient falloff.

**Glow philosophy:** Glows are warm-yellow halos (`#F2E4A8` family) applied as
`text-shadow` only on title text and nav active labels — never as `box-shadow`
on card surfaces.

| Glow token | Value | Use |
|------------|-------|-----|
| `GLOW_TITLE` | `0 0 14px rgba(242,228,168,0.45), 0 0 32px rgba(242,228,168,0.2)` | Hero titles, app wordmark |
| `GLOW_SOFT` | `0 0 14px rgba(242,228,168,0.3), 0 0 30px rgba(242,228,168,0.14)` | Section h2, stat numbers |
| `GLOW_NAV` | `0 0 12px rgba(242,228,168,0.5), 0 0 24px rgba(242,228,168,0.22)` | Active nav links |

---

## 7. Do's and Don'ts

### Do
- Use `#0D1A14` as the page background — always, no exceptions
- Import colors from `src/lib/theme.ts` — never hardcode hex in components
- Apply `PALE_YELLOW` (`#F2E4A8`) + `GLOW_SOFT` on all page-level `<h2>` titles
- Use `COPPER_BORDER` (`rgba(196,145,95,0.45)`) on all card borders
- Use `brand.orange` (`#DA7422`) for all active button states and CTAs
- Add `touch-action: manipulation` on all interactive elements (prevents 300ms tap delay)
- Make every tap target at least 44px tall — use `min-h-[44px]` or `py-2.5+` padding
- Use `max(1rem, env(safe-area-inset-top/bottom))` on modal backdrops
- Stack form fields vertically on mobile (`flex-col`) and row on `sm:` breakpoint
- Use `scrollbar-width: none` + `-webkit-scrollbar: display:none` on horizontal scroll containers
- Add `-webkit-overflow-scrolling: touch` on scrollable containers for iOS momentum

### Don't
- Don't use pure black (`#000`) as a surface — use the forest green family
- Don't introduce blue, purple, or cool-toned borders — copper is the only border color
- Don't apply `GLOW_*` as `box-shadow` — only `text-shadow` on text elements
- Don't use `items-center` on modal backdrops — use `items-start` + `overflow-y-auto` so tall modals scroll rather than clip
- Don't hardcode colors in component files — use theme tokens
- Don't add `resize` to textareas — always `resize-none` with auto-grow via `scrollHeight`
- Don't use more than two fonts (Inter + DM Serif Display)
- Don't use white or light backgrounds anywhere in the app shell
- Don't use default browser focus outline — use `focus:ring-2 focus:ring-brand-orange`
- Don't introduce new animations outside the defined `tailwind.config.ts` keyframes without good reason

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key change |
|------|-------|------------|
| Mobile | `< 640px` (default) | Single column, bottom tab nav |
| `sm` | `≥ 640px` | Two-column form rows, desktop-table layouts |
| `md` | `≥ 768px` | Wider cards, sidebar rail begins |
| `lg` | `≥ 1024px` | Full desktop layout |

The app is **mobile-first**. All default styles target mobile; `sm:` and above
add desktop enhancements.

### Touch Targets

- Buttons: minimum `py-2` (32px) — prefer `py-2.5` (40px) for primary actions
- Nav tabs: 48px+ height
- Heatmap cells: 14px × 14px on mobile, tap opens `SessionDetailModal`
- Horizontal scroll carousels: `touch-manipulation`, `scroll-snap-type: x mandatory`

### Collapse Strategy

| Pattern | Mobile | `sm:` |
|---------|--------|-------|
| Form rows (Style + Type) | `flex-col` stacked | `flex-row` side by side |
| Table → cards | Card surface per row (`rounded-xl`, `border border-white/[0.07]`) | `grid-cols-[…]` table layout |
| Navigation | Bottom tab bar (fixed) | Left sidebar rail |
| Analytics view tabs | Visible horizontal pill row | Hidden (desktop uses icon rail) |
| Modal max-width | `w-full` | `sm:max-w-md` or `sm:max-w-lg` |
| Page padding | `px-4` | `px-6` |

### Safe Areas (iOS notch / home indicator)

All fixed bottom bars and modal backdrops must account for safe areas:
```css
padding-bottom: env(safe-area-inset-bottom);           /* nav bar */
padding-top: max(1rem, env(safe-area-inset-top));      /* modal backdrop top */
padding-bottom: max(1rem, env(safe-area-inset-bottom));/* modal backdrop bottom */
```

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
Page background:    #0D1A14
Card surface:       #152E22
Card border:        rgba(196,145,95,0.45)
Card shadow:        0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)
Modal backdrop:     rgba(13,26,20,0.85) + blur(12px) saturate(1.2)
Title text:         #F2E4A8  (+ GLOW_SOFT text-shadow)
Body text:          rgba(255,255,255,0.80)
Muted text:         rgba(255,255,255,0.35)
Active / CTA:       #DA7422  (brand.orange)
Success / Gi:       #6FD08C  (brand.green)
Light / easy:       #CDDFA0  (brand.light-green)
Copper border:      #C4915F  (COPPER)
```

### Ready-to-use Prompts

**Build a card:**
> Card with `#152E22` background, `1px solid rgba(196,145,95,0.45)` border,
> `border-radius: 16px`, `box-shadow: 0 2px 4px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.35)`,
> padding 24px. Title 18px weight 600 `rgba(255,255,255,0.90)`. Body 14px weight 400
> `rgba(255,255,255,0.80)` with `leading-relaxed`.

**Build a page title:**
> `<h2>` in `#F2E4A8`, 24px bold, `tracking-tight`, `text-shadow: 0 0 14px rgba(242,228,168,0.3), 0 0 30px rgba(242,228,168,0.14)`.

**Build a primary button:**
> `background: #DA7422`, white text, `padding: 10px 24px`, `border-radius: 8px`,
> `font-size: 14px`, `font-weight: 500`. Hover: `rgba(218,116,34,0.90)`. Disabled: `opacity: 0.50`.

**Build a modal:**
> Backdrop: `position: fixed; inset: 0; background: rgba(13,26,20,0.85); backdrop-filter: blur(12px) saturate(1.2); display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))`.
> Box: `background: #152E22; border: 1px solid rgba(196,145,95,0.45); border-radius: 16px; width: 100%; max-width: 28rem; max-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem); overflow-y: auto; padding: 24px`.

**Build an input:**
> `background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; padding: 10px 16px; color: white; placeholder: rgba(255,255,255,0.30)`. Focus: `outline: none; box-shadow: 0 0 0 2px #DA7422`.

**Build a category badge:**
> `background: {color}20; color: {color}; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 500; text-transform: capitalize`.
> Category colors — technical: `#60a5fa`, physical: `#f87171`, mental: `#a78bfa`, positional: `#34d399`, competitive: `#fbbf24`.

**Build a mobile table → card list:**
> On mobile (`< 640px`): each row is `rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-3 mb-2`.
> On `sm:` (640px+): revert to `grid grid-cols-[…]` table layout, no card surface.

### Animation Reference

All keyframes are defined in `tailwind.config.ts`. Use via Tailwind classes:

| Class | Duration | Easing | Use |
|-------|----------|--------|-----|
| `animate-j2-page-in` | 360ms | `cubic-bezier(0.16,1,0.3,1)` | Page mount |
| `animate-j2-card-enter` | 500ms | `cubic-bezier(0.16,1,0.3,1)` | Card appear |
| `animate-j2-modal-in` | 400ms + 80ms delay | `cubic-bezier(0.16,1,0.3,1)` | Modal open |
| `animate-j2-backdrop-in` | 250ms | `ease` | Backdrop fade |
| `animate-view-exit-up/down` | 500ms | `cubic-bezier(0,0,0.3,1)` | Panel exit |
| `animate-view-enter-up/down` | 560ms + 120ms delay | `cubic-bezier(0.2,1.1,0.4,1)` | Panel enter (spring) |
| `animate-j2-today-pulse` | 4s loop | `ease-in-out` | Today heatmap cell |
| `animate-j2-shimmer` | 1.2s | `ease-out` | Skeleton loading |

#### GSAP Animations

GSAP (v3.14.2) is used when an animation requires spring physics, per-element stagger, or runtime-controlled timing that CSS keyframes cannot express.

| Component | Technique | Easing | Total duration |
|---|---|---|---|
| `BeltDateBanner` | Venetian-blind `rotateX` unfurl, left → right | `elastic.out(1, 0.65)` / `elastic.out(1.1, 0.5)` / `power2.out` | ~1.0 s |

**Timing constants** (`BeltDateBanner.tsx`):

| Constant | Value | Role |
|---|---|---|
| `STAGGER_S` | `0.04` s | Delay between each belt slice start |
| `SLAT_DURATION_S` | `0.38` s | Individual slat flip duration |
| `PATCH_DURATION_S` | `0.32` s | Patch "slap" duration |
| `TEXT_DURATION_S` | `0.25` s | Date text fade-in |

**Pattern**: `gsap.set()` for initial hidden state → `gsap.timeline()` with sequential `.to()` calls → `return () => { tl.kill(); }` in `useEffect` teardown.

**When to use GSAP vs Tailwind classes**:
- Use **Tailwind** (`tailwind.config.ts` keyframes) for stateless, repeating, or hover/transition animations — page transitions, modal opens, skeleton shimmer, pulse.
- Use **GSAP** when you need spring/elastic easing, staggered multi-element sequencing, or timeline-based choreography with overlapping tweens.

### Iteration Guide

1. Start on `#0D1A14` — every new page and component
2. Raise to `#152E22` for any content-bearing surface — add `rgba(196,145,95,0.45)` border
3. Title the section with `#F2E4A8` + `GLOW_SOFT` text-shadow
4. Use `rgba(255,255,255,0.80/0.60/0.35)` for body → secondary → muted text
5. Reach for `#DA7422` (brand.orange) only for the one primary CTA or active state per context
6. Check touch targets — if anything is shorter than 44px, add more vertical padding
7. Add `touch-action: manipulation` on every `<button>` and `<a>`
8. Test in Chrome DevTools at **Pixel 7** (412px) and **iPhone 14** (390px) before shipping
