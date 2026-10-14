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
- Two typefaces: **Plus Jakarta Sans** (all UI) and **Cormorant Garamond** (display + narrative voice only — see §3 role rules)
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
| `SAGE` | `#8FB56A` | Journal-page time markers — entry dates, elapsed-time readouts, session-type marker. See role note below |
| `brand.orange` | `#DA7422` | Active button state, CTA, selected pill |
| `brand.green` | `#6FD08C` | **Legacy.** Live only as the 12/16-week gate colour in `EIGHT_GATES`. Not success (use `STATUS_SUCCESS`), not heatmap intensity (use `INT_COLORS`) |
| `brand.light-green` | `#CDDFA0` | **Legacy.** Live only as a defensive `??` fallback behind `INT_COLORS`. Do not reach for it in new work |
| `brand.dark` | `#0D1A14` | Same as PAGE_BG — Tailwind alias |

**The `SAGE` role.** Sage marks *when* something happened. It is what makes a
list read as journal pages rather than table rows, so it stays on time markers
and nothing else:

- entry and session dates (`HomeEntryList`, `IntentionsDesk`, `JournalDesktop`)
- elapsed-time readouts (`SessionVideoBlock` timestamps, `PositionTagger` tagged-coverage)
- the session-type marker (`JournalDesktop` type key, the `Session` eyebrow label)

Sage is never a border, never a CTA, never body text, and never a status. If
what you are colouring is not a date, a duration, or a session-type marker,
sage is the wrong token. Import it from `theme.ts` — `#8FB56A` written as a
literal is a failure even where the role is correct.

### Intention Category Colors

**Retired — do not cite, do not extend.** The shipped palette
(`CATEGORY_COLORS` in `src/lib/constants.ts`) is a Tailwind rainbow that
contradicts this document and `CLAUDE.md`:

| Category | Shipped value | Why it is wrong |
|----------|---------------|-----------------|
| technical | `#60a5fa` | Blue. `CLAUDE.md` permits no blue except `PRESTIGE_BLUE` on streaks |
| mental | `#a78bfa` | Violet. Cool-toned; §7 forbids introducing purple |
| physical | `#f87171` | The retired cold red — see Status / Feedback above |
| positional | `#34d399` | Tailwind emerald; outside the warm forest register |
| competitive | `#fbbf24` | Tailwind amber; outside the register |
| presence | `#4BA862` | Ships today, never documented here |

A replacement has been mandated but **not yet chosen** — the decision is tracked
in JOU-40. Until it lands: reject new work that reaches for these six values,
and do not invent a substitute locally. Any replacement must satisfy all of:

- **Six categories, not five.** `presence` ships and must be documented.
- **No blue, violet, or cool tones**; no return of cold red under a new name.
- **Disjoint from role tokens.** A category swatch must not equal `PALE_YELLOW`
  (titles), `BRAND_ORANGE` (the only colour allowed on a tappable affordance),
  `SAGE` (time markers), any `STATUS_*` value, or any `INT_COLORS` step —
  otherwise a category pill reads as a title, a button, a date, an error, or an
  intensity.
- **Distinguishable at pill scale** on `CARD_BG` with a `20`-opacity background.

Note for whoever resolves it: the warm forest register is already fully spoken
for by the constraints above, so six *mutually* distinguishable warm hues cannot
be drawn from existing tokens. The honest options are to mint six new
category-only hues, or to stop encoding category as colour at all and let one
neutral copper pill carry a label or glyph. The second is cheaper and more in
keeping with a journal; six-colour coding is a dashboard idiom.

### Intensity / Heatmap Scale

Single source of truth: `INT_COLORS` / `INT_LABELS` in `theme.ts` (aliased as
`INTENSITY_COLOR` in `sessionUtils.ts`). The ladder walks **moss → champagne →
copper**, staying inside the brand register. The earlier lime-green →
fluorescent-orange ramp was deliberately abandoned — do not reintroduce it.

| Intensity | Token | Color | Label |
|-----------|-------|-------|-------|
| 0 | `INT_COLORS[0]` | `rgba(255,255,255,0.06)` | — (rest / empty swatch) |
| 1 | `INT_COLORS[1]` | `#5E8A5C` | Drill |
| 2 | `INT_COLORS[2]` | `#7BA177` | Light |
| 3 | `INT_COLORS[3]` | `#A8B97A` | Steady |
| 4 | `INT_COLORS[4]` | `#D4B86A` | Intense |
| 5 | `INT_COLORS[5]` | `#C4915F` | Hard roll (= `COPPER`) |

Calendar empty / future cell *backgrounds* remain `HEATMAP_REST` and
`HEATMAP_FUTURE` from the Background Surfaces table above.

### Text Scale

Import these from `theme.ts` — a raw `rgba(255,255,255,…)` as a text colour is a
failure, exactly like a raw hex. The previous version of this table listed five
values that the app had already abandoned (`0.80` had 8 uses while the
undocumented `0.40` had 63), which made the scale unenforceable. The values
below instead ratify the scale 13 files had already converged on by hand.

| Token | Value | Role |
|-------|-------|------|
| `PALE_YELLOW` | `#F2E4A8` | Titles, stat numbers (not an opacity — see Accent & Brand) |
| `TEXT_PRIMARY` | `rgba(255,255,255,0.92)` | Emphasis values, read-view body |
| `TEXT_BODY` | `rgba(255,255,255,0.80)` | Long-form prose, journal body |
| `TEXT_SECONDARY` | `rgba(255,255,255,0.66)` | Field labels, sub-values |
| `TEXT_TERTIARY` | `rgba(255,255,255,0.46)` | Metadata, timestamps, counts |
| `TEXT_HINT` | `rgba(255,255,255,0.26)` | Placeholders, empty-state hints |
| `TEXT_DISABLED` | `rgba(255,255,255,0.15)` | Disabled / ghost |

**Why these exact values.** `TEXT_PRIMARY` / `TEXT_SECONDARY` / `TEXT_TERTIARY` /
`TEXT_HINT` already exist as copy-pasted local `const` declarations in 13
component files, and 11 of them agree on `0.66` / `0.46`. This table adopts that
consensus rather than inventing a new ramp. `LandingPage.tsx` is the one file
that drifted — it defines the *same names* at `0.90` / `0.60` / `0.40`, which is
precisely the failure real tokens prevent.

**Normalising an off-scale value:** round to the nearest step. Where a value sits
equidistant between two steps, take the lighter one — contrast on `CARD_BG` is
already tight at the bottom of the scale.

Opacity is for *white* text only. Champagne text that needs de-emphasis uses
`rgba(242,228,168,…)` (see the narrative-line row in §3), not a `TEXT_*` token.

### Status / Feedback

Import these from `theme.ts` — never write the literal. The palette stays inside
the warm forest register: error is a desaturated terracotta, **not** Tailwind
cold-red. `#f87171` / `rgba(248,113,113,…)` / `text-red-400` are retired; the
`STATUS_*` tokens exist specifically to replace them.

| State | Token | Value |
|-------|-------|-------|
| Error / destructive | `STATUS_ERROR` | `#E07560` |
| Error background | `STATUS_ERROR_BG` | `rgba(224,117,96,0.10)` |
| Error border | `STATUS_ERROR_BORDER` | `rgba(224,117,96,0.30)` |
| Success / saved / sent | `STATUS_SUCCESS` | `#A8B97A` (moss-3 from `INT_COLORS`) |
| Success background | `STATUS_SUCCESS_BG` | `rgba(168,185,122,0.10)` |
| Success border | `STATUS_SUCCESS_BORDER` | `rgba(168,185,122,0.30)` |
| Info / noteworthy notice | `STATUS_INFO` | `#C4915F` (= `COPPER`) |
| Info background | `STATUS_INFO_BG` | `rgba(196,145,95,0.10)` |
| Info border | `STATUS_INFO_BORDER` | `rgba(196,145,95,0.30)` |

Offline / queued state uses the copper info register (`OfflineBanner.tsx`), not
amber. Tailwind exposes the error colour as `error` (`#E07560`) for class strings.

---

## 3. Typography Rules

### Font Families

```css
font-family: '"Plus Jakarta Sans", system-ui, sans-serif';   /* all UI — body, buttons, inputs, labels, metadata */
font-family: '"Cormorant Garamond", Georgia, serif';         /* editorial voice — FONT_EDITORIAL in theme.ts */
```

Plus Jakarta Sans is the workhorse: every button, link, input, metadata line,
duration, label, and body paragraph. Cormorant Garamond (`FONT_EDITORIAL`) is
the editorial voice and is allowed in exactly **two roles** — see below.

### The Serif Role Rules

The serif exists to give the app its "night-time dojo" register. It stays
special only if it stays scarce. Two roles, nothing else:

1. **Upright serif — display only.** Hero numerals (streak number, stat
   numbers), page titles, card titles, journal date leaves. Never body text,
   never metadata, never values inside rows.
2. **Italic serif — narrative voice only.** One reflective sentence per
   screen at most: the coach-voice prompt ("Getting some rolls in?"), the
   telemetry narrative. **Never** buttons, links, inputs, placeholders,
   durations, relative times, or status fragments.

**Hard rules:**
- Anything tappable is sans. If it has an `onClick`, it is Plus Jakarta Sans.
- Anything the user types is sans. Inputs and textareas never use the serif.
- Values (durations, counts, times inside rows/meta lines) are sans. The serif
  numeral treatment is reserved for *display* stats, not inline data.

### Hierarchy

| Role | Font | Size | Weight | Color | Notes |
|------|------|------|--------|-------|-------|
| Hero numeral | Serif upright | 30px+ | 500 | `PALE_YELLOW` | + `GLOW_SOFT`; `.j2-serif-display` |
| Page title | Serif upright | 26–28px | 500–600 | `PALE_YELLOW` | + `GLOW_SOFT` |
| Card title | Serif upright | 18–28px | 500–600 | `PALE_YELLOW` | compact 18, full 26–28 |
| Narrative line | Serif italic | 15–18px | 500 | `rgba(242,228,168,0.62–0.72)` | `.j2-serif-italic`; max one per screen |
| Body / description | Sans | 13–15px | 400 | `rgba(255,255,255,0.80)` | `leading-relaxed` |
| Button / action link | Sans | 13–14px | 600 | white / `COPPER` | never italic, never serif |
| Input | Sans | 15–16px | 400 | `rgba(255,255,255,0.90)` | placeholder ~0.35 opacity |
| Row value (duration etc.) | Sans | 13–15px | 600 | `COPPER` | matches Home week-list rows |
| Metadata line | Sans | 11–13px | 400–600 | `rgba(255,255,255,0.38–0.55)` | plain case or uppercase-tracked |

### Uppercase Label Tiers — exactly two

| Tier | Token / spec | Use |
|------|--------------|-----|
| Eyebrow / kicker | `.j2-label-micro` (11.5px · 700 · 0.18em · white 0.40) or `.j2-label-copper` (same, copper) | Section eyebrows ("Training Telemetry", "Last 30 days · pulse"), card kickers ("◇ This week"), month headers, weekday leaves |
| Sub-stat label | 10px · 600 · 0.12em · white 0.32–0.42 | Labels under stat numbers, chart axis dates |

Do not invent new size/tracking/opacity combinations. If a label doesn't fit
one of these two tiers, it is probably not an uppercase label.

### Tracking

- Serif display: slight negative (`-0.005` to `-0.025em` as size grows)
- Uppercase labels: per the two tiers above — 0.18em (eyebrow) or 0.12em (sub-stat)
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
background: rgba(224,117,96,0.10)        (STATUS_ERROR_BG)
text: #E07560                            (STATUS_ERROR)
border: 1px solid rgba(224,117,96,0.30)  (STATUS_ERROR_BORDER)
border-radius: 8px
```
Import the three `STATUS_ERROR*` tokens rather than retyping the values. This is
the shipped pattern in `ProfilePage`, `ProfileDesktop`, `LoginPage`,
`ReportProblemModal`, `AdminDashboardPage`, and `AdminUserDetailPage`.

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

**Sheets are modals.** There is no separate full-bleed, slide-up, or drawer
surface class in Journada. A panel that covers the screen edge-to-edge, slides
up from the bottom, or anchors to an edge is a modal and conforms to the box
above: centred horizontally, `max-width: 28rem` (or `42rem` for the large
variant), `border-radius: 16px`, `COPPER_BORDER`, on the blurred
`rgba(13,26,20,0.85)` backdrop with `items-start` + `overflow-y: auto`.

A component named `*Sheet` is not exempt — the name describes where it came
from, not a different spec. Full-bleed panels read as a native OS surface rather
than an object resting on the page, which is the opposite of the "card floating
on forest" model everything else follows.

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
- Don't write `rgba(255,255,255,0.X)` as a text colour — use a `TEXT_*` token (§2 Text Scale)
- Don't declare a token-named `const` locally (`const TEXT_SECONDARY = …`) — import it, or the same name drifts to different values across files
- Don't build a full-bleed, slide-up, or drawer surface — a sheet is a modal and conforms to the modal box (§4)
- Don't spend `SAGE` on anything that isn't a date, a duration, or a session-type marker
- Don't add `resize` to textareas — always `resize-none` with auto-grow via `scrollHeight`
- Don't use more than two fonts (Plus Jakarta Sans + Cormorant Garamond), and don't let the serif escape its two roles: upright = display, italic = one narrative line. Never serif on buttons, inputs, or inline values.
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
Body text:          rgba(255,255,255,0.80)  (TEXT_BODY)
Label text:         rgba(255,255,255,0.66)  (TEXT_SECONDARY)
Metadata text:      rgba(255,255,255,0.46)  (TEXT_TERTIARY)
Date / duration:    #8FB56A  (SAGE — time markers only)
Active / CTA:       #DA7422  (brand.orange)
Error:              #E07560  (STATUS_ERROR)
Success / saved:    #A8B97A  (STATUS_SUCCESS)
Intensity ladder:   #5E8A5C → #7BA177 → #A8B97A → #D4B86A → #C4915F  (INT_COLORS 1–5)
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
> `background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.10); border-radius: 8px; padding: 10px 16px; color: white; placeholder: rgba(255,255,255,0.26)` (`TEXT_HINT`). Focus: `outline: none; box-shadow: 0 0 0 2px #DA7422`.

**Build a category badge:**
> `background: {color}20; color: {color}; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 500; text-transform: capitalize`.
> **Do not fill in `{color}` from the old palette** — the category colours are
> retired and their replacement is pending (§2 Intention Category Colors). Until
> that decision lands, use `STATUS_INFO` (copper) for every category and let the
> label carry the distinction.

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
