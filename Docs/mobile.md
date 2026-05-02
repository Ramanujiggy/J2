# Mobile Layout Strategy

Journada is a **mobile-first app**. The primary use case is a BJJ practitioner logging sessions from a phone at the gym, reviewing their week on the train, or journalling after training. Desktop is a secondary surface.

This document tracks the current responsive state, identifies what needs work, and defines the approach for each view.

---

## Current Baseline

### What Already Works on Mobile

| Element | Status | Notes |
|---|---|---|
| Bottom navigation bar | ✅ | `sm:hidden fixed bottom-0` — 5 tabs with icons + labels |
| Page container padding | ✅ | `px-4 sm:px-6` across all pages |
| Login / register page | ✅ | `max-w-sm` card, full-width inputs |
| SkillRadar (Analytics) | ✅ | Separate mobile rendering path (`sm:hidden`) — flat layout, 210px chart, no drum animation |
| LogSessionForm skill tags | ✅ | `flex flex-wrap` — wraps to multiple rows |
| SessionDetailModal overlay | ✅ | `px-4` padding, fills screen width |
| Intentions history list | ✅ | Grid collapses, text truncates |
| Profile form | ✅ | Single column, full-width inputs |
| `pb-20` on `<main>` | ✅ | Content clears fixed bottom nav |
| Safe-area insets (notch + home indicator) | ✅ | `viewport-fit=cover` + `env(safe-area-inset-*)` honored across AppShell, modals, pages. See [frontend.md](frontend.md#mobile--ios-baseline). |
| iOS native-feel CSS baseline | ✅ | Tap-highlight removed, `touch-action: manipulation` (no 300ms tap delay), `overscroll-behavior: none`, text-size-adjust pinned. Global rules in `src/index.css`. |
| iOS keyboard hints on inputs | ✅ | `enterKeyHint`, `inputMode`, `autoComplete`, `autoCapitalize`, `autoCorrect` on auth, password reset, profile, journal search. |
| Tap targets ≥44pt | ✅ | iOS HIG minimum honored (bottom nav, FAB, modal close, profile stripes). |

---

## Known Mobile Issues

### Critical

| Issue | Component | Impact |
|---|---|---|
| Heatmap requires horizontal scroll | `TrainingHeatmap` | Full-year grid has fixed column widths (`5rem 7×auto 13rem 7rem`) — cannot fit on a phone. **Note:** The new `CompactHeatmap` (accessible via the toggle on CalendarPage) provides a mobile-friendly scrollable alternative with 18px fixed cells and auto-scroll to today. |
| Day cards: explicit horizontal scroll | `PathAheadPage` | `overflow-x-auto` on 11-day row is intentional but unpolished on small phones — no scroll snap, no momentum feel |

### Medium

| Issue | Component | Impact |
|---|---|---|
| Analytics intent table not adapted | `AnalyticsPage` | 3-column grid without column headers on mobile — content renders but is cramped |
| Intentions page 4-column grid | `IntentionsPage` | `grid sm:grid-cols-[80px_1fr_1fr_100px]` — on mobile no explicit single-column fallback |
| Gi/No-Gi + Type in LogSessionForm | `LogSessionForm` | `flex gap-6` on one row — may crowd on narrow screens |
| Journal textarea height | `JournalEntryPage` | `minHeight: 280` fixed — large on a small phone viewport |

### Low

| Issue | Component | Impact |
|---|---|---|
| SessionDetailModal 2×2 grid | `SessionDetailModal` | Stat tiles may be cramped on phones narrower than 360px |
| SetIntentionModal duration buttons | `SetIntentionModal` | 4 buttons in `flex gap-1.5` — may not wrap on very small screens |
| No scroll handling on tall modals | All modals | A tall modal on a short phone viewport has no internal scroll fallback |
| No focus trapping in modals | All modals | Accessibility gap — tab key can leave the modal |
| Modals have no `max-height` + scroll | All modals | Content could extend off-screen |

---

## Layout Strategy by View

### Path Ahead (`/home`) — Day Cards

**Current:** 11 DayCards (today ± 5 days) in a `flex overflow-x-auto` row with `min-w-[128px]` per card. Intentional horizontal scroll.

**Goal:** Keep horizontal scroll — this is a common mobile pattern (like a calendar strip). Polish it:
- Add `scroll-snap-type: x mandatory` to the scroll container
- Add `scroll-snap-align: start` to each DayCard
- Ensure `scrollbar-hide` so the scrollbar doesn't show on Android Chrome
- Ensure `overscroll-behavior-x: contain` to prevent page scroll conflict
- On very small phones (<360px), consider reducing card `min-w` to `112px`

### Calendar (`/calendar`) — Heatmap

**Current:** Two views available via a segmented toggle:

**Compact view (✅ implemented)** — `CompactHeatmap`
- GitHub contribution-graph style, 18px fixed cells, hidden-scrollbar horizontal scroll
- Auto-scrolls to today's column on mount
- Stats row (Sessions, Hours, Gi%, Streak) with animated count-up
- Legend row at bottom
- Fully mobile-friendly — this is effectively Option A, now live

**Detailed view** — `TrainingHeatmap`
- Full-year fixed-width grid, still requires horizontal scroll on mobile
- Retains full interactivity (click → SessionDetailModal, intention overlays, journal links)

**Option B — Month list view on mobile (future)**
- On mobile (`<640px`), replace the year grid with a vertical list of months
- Each month accordion: collapsed = month name + session count + dominant colour; expanded = mini 7-column grid
- Significantly more work — mark as a future sprint

### Analytics (`/analytics`)

**Current:** SkillRadar has a fully separate mobile rendering path. On mobile (`sm:hidden`), it renders a flat `flex-col` layout with the chart at 210px width and the breakdown rows below — no drum, no animation, no `absolute inset-0` conflicts. On desktop (`hidden sm:flex`), the original animated drum with slide transitions is unchanged.

The Intention vs Ambient Focus table doesn't adapt — it renders a 3-column grid without a meaningful single-column fallback on mobile.

**Goal:**
- Intention vs Ambient Focus: on mobile, show each row as a stacked card (label on top, ambient focus below) rather than a 3-column grid

### Intentions (`/intentions`)

**Current:** 4-column grid (`grid sm:grid-cols-[80px_1fr_1fr_100px]`) with hidden headers on mobile.

**Goal:** On mobile, render each intention as a stacked card:
- Week label (small, top)
- Intention category pill + label (headline)
- Ambient focus (below, copper colour)
- Journal link (bottom right)

This turns the table into a card list on mobile, which is much more readable.

### Session Detail Modal

**Current:** `max-w-md`, 2×2 stat tile grid, `p-6`.

**Goal:**
- Add `max-h-[90vh] overflow-y-auto` to the modal inner content so very tall content scrolls within the modal
- Add `overscroll-behavior: contain` so scroll doesn't bleed to background
- Reduce `p-6` to `p-4 sm:p-6` for tighter mobile spacing
- The 2×2 grid is fine on all phones ≥320px

### Log Session Form

**Current:** `p-6` on the card, `flex gap-6` on Gi/No-Gi + Type row.

**Goal:**
- Change Gi/No-Gi + session type from `flex gap-6` to `flex flex-col sm:flex-row gap-3 sm:gap-6`
- Reduce form card padding to `p-4 sm:p-6`

### Journal Entry (`/intentions/:id/journal`)

**Current:** `minHeight: 280` on textarea.

**Goal:**
- Use `calc(100dvh - 260px)` or similar for textarea height on mobile so it fills the visible viewport without being cropped
- `dvh` (dynamic viewport height) accounts for browser chrome (address bar show/hide)

---

## General Mobile Principles

1. **Touch targets:** All interactive elements should be ≥44×44px. Current intensity buttons (40px) are borderline — bump to 44px.
2. **No horizontal overflow:** Every page must fit in 360px wide without unexpected scroll except intentional scroll containers (day card strip, heatmap).
3. **Modals:** All should have `max-h-[90dvh] overflow-y-auto` and `overscroll-behavior: contain`.
4. **Swipe / scroll snap:** Day card strip should use CSS scroll snap for a native feel.
5. **Bottom nav clearance:** `pb-20` on `<main>` ensures content is never hidden behind the fixed nav. Confirm this works on all modal pages too.
6. **Font sizes:** Minimum 12px for any readable text. Current `text-[10px]` labels (belt bar tails, some chips) should be verified on physical devices.
7. **dvh units:** Prefer `100dvh` over `100vh` for full-screen elements — `dvh` adjusts for mobile browser chrome.
8. **Viewport meta:** Confirm `<meta name="viewport" content="width=device-width, initial-scale=1">` is in `index.html`.

---

## Priority Order

| Priority | Task | Effort | Status |
|---|---|---|---|
| 1 | Day card scroll snap + `scrollbar-hide` | Small | 🔲 |
| 2 | Modal `max-h` + overflow scroll | Small | 🔲 |
| 3 | LogSessionForm layout fix (Gi/No-Gi + type stacking) | Small | 🔲 |
| 4 | Intentions: stacked card layout on mobile | Medium | 🔲 |
| 5 | Analytics: Intention vs Ambient Focus table — stacked cards on mobile | Small | 🔲 |
| 6 | Journal textarea dynamic height | Small | 🔲 |
| 7 | Calendar: scrollable compact view | Small | ✅ CompactHeatmap |
| 8 | Calendar: month accordion view on mobile | Large | 🔲 Future sprint |

---

## Tablet Considerations

Tablets (768px–1024px) sit between the mobile and desktop breakpoints. The current `sm:` breakpoint at 640px means tablets mostly get the desktop layout, which works well. Points to watch:

- Day cards: on a 768px tablet, the 11-card row has plenty of room — no scroll needed
- Heatmap: on a 768px tablet in landscape, the full-year grid fits with minimal scroll
- SkillRadar: side-by-side layout looks good at 768px+
- Bottom nav hidden (`sm:hidden`) — tablets get the top desktop nav, which is correct
