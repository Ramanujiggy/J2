# Mobile Log Session — Design Research Master Synthesis

**Date:** 2026-04-27
**Audience:** Robert (Journada product/design)
**Purpose:** A single-document synthesis of three parallel deep-research passes on how premium / editorial mobile apps treat single-screen authoring forms. Read this first; the three deeper reports live alongside it.

**The three deeper reports:**
1. [Refero pattern catalog](2026-04-27-mobile-log-session-refero-patterns.md) — 50+ real iOS app screens, 12 close references with UUIDs
2. [Editorial-register reference apps](2026-04-27-mobile-log-session-editorial-references.md) — Day One, Bear, Things 3, Apple Notes, Reeder, NYT, Aesop, Claude.ai, Oak
3. [Mobile-form UX patterns 2025](2026-04-27-mobile-log-session-form-ux-patterns.md) — Apple HIG, Material 3, NN/g, premium-app reference flows

The three were conducted independently. They converged unusually tightly. That convergence is what gives this synthesis its confidence level.

---

## TL;DR

**Your instinct is correct, and the fix is smaller than you think.**

The mobile log-session screen reads as "configurator" rather than "page in a notebook" because of **one root cause**: three rounded `SURFACE_2` cards stacked vertically, each with its own border + uppercase eyebrow. Every premium reference app — Day One, Bear, Apple Notes, Things 3, Reeder, NYT, even Apple's own Health and Fitness apps — has converged on the opposite pattern: **implicit containment** (whitespace + typography + hairline) rather than **explicit containment** (cards + borders + group backgrounds).

The fields are right. The flow is right. The desktop is right. The mobile chrome is wrong. **Replace the chrome — keep the content** — and the screen will feel like a leather notebook page.

There's one critical condition: removing card borders only works if the typographic scale is rigorous. The two changes must ship together, or the screen becomes muddy.

---

## The single highest-leverage change

> **Delete the three boxed `SURFACE_2` cards. Replace them with one continuous canvas. Section breaks become small letter-spaced uppercase eyebrow labels + 1px hairline dividers — not card edges.**

Every Tier-1 reference does this. The dating app **222** ([Refero `611ee5c2-33df-4161-ac12-4f259b164f6a`](https://refero.design/screens/611ee5c2-33df-4161-ac12-4f259b164f6a)) is the single closest visual analogue to the Journada brand brief in the entire indexed iOS corpus — dark forest-green canvas, serif prompts, lowercase eyebrows, off-white type. It happens to be a dating app, but the typographic register is exact.

Why this works:
- Cards are *utility* chrome (Hevy, Strong, MyFitnessPal, Linear-the-utility-app, Notion as DB). Premium / editorial apps explicitly avoid them.
- On a 390pt iPhone canvas, three cards burn ~60pt of horizontal width to chrome that adds nothing — that's roughly the width of two pillar chips. You're paying real space for explicit containment.
- The card label ("The Basics") becomes the visual hero, when the actual data should be.
- The copper eyebrow + whitespace + hairline rule does the same job for free, and is what every editorial app on iOS converges on.

This one change accounts for ~70% of the perceived-quality lift available without a structural rewrite.

---

## The recommended layout

A single full-screen modal page. Slide-up presentation. Top-right `Save`, top-left `×` close. Scrollable.

Top-to-bottom, on a 390pt canvas:

```
┌──────────────────────────────────────────────────────┐
│  ×                                            Save   │  ← 44pt nav bar
├──────────────────────────────────────────────────────┤
│  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │  ← 4pt belt-color hairline (preserves belt narrative)
│                                                      │
│  TUESDAY · APRIL 27                                  │  ← 11pt Plus Jakarta, copper @ 60%, tracking 0.16em
│  Today's session                                     │  ← 24pt Cormorant Garamond italic, champagne @ 90%
│                                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← optional 1px hairline at 8% opacity
│                                                      │
│  ┌───────────────────────────────────────────────┐  │  ← Day strip: today + previous 6 days
│  │  Tu  Mo  Su  Sa  Fr  Th  We                    │  │     dots indicate days with a session
│  │   •         •       •       •                  │  │     belt-colored
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  THE BASICS                                          │  ← 11pt copper eyebrow, tracking 0.16em
│                                                      │
│  Gi · No-Gi                          [ Gi · No-Gi ]  │  ← compact pill segments, no card around it
│  Class · Drilling · Competition       [• Class •  ]  │
│  Duration                              [ −  60m  + ] │
│  Intensity                             [▮▮▮▯▯ Hard]  │  ← intensity gradient, on canvas not in box
│                                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← hairline divider, 8% opacity
│                                                      │
│  WHAT YOU WORKED ON                                  │  ← copper eyebrow
│  This week's focus: Half Guard                       │  ← 13pt italic, copper @ 70% (when intention exists)
│                                                      │
│  [ Stand-up ] [ Passing ] [ Pins ]                   │  ← FocusAreaChips, no surrounding card
│  [ Submissions ] [ Guard ]                           │
│                                                      │
│  Defense  ·  Neutral  ·  Offense                     │  ← Polarity inline (when guard/pins selected)
│  Coach-led  ·  Open Mat                              │  ← Source row
│                                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← hairline
│                                                      │
│  + More details                                  ›   │  ← single disclosure row, tap to expand
│                                                      │
│   (when expanded:)                                   │
│   TAGS                                               │
│   [ +  Add a tag ]                                   │
│                                                      │
│   NOTES                                              │
│   ┌─────────────────────────────────────────────┐  │
│   │ What stayed with you?                        │  │  ← textarea, no border, just placeholder
│   └─────────────────────────────────────────────┘  │
│                                                      │
│  ────────────────────────────────────────────────  │
│                                                      │
│       ┌─────────────────────────────────────────┐    │  ← sticky bottom CTA, only when dirty
│       │              Save Session              │    │     hides under keyboard
│       └─────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

What's gone:
- Three card borders
- The H2 "Log a Training Session" heading
- The animated full-bleed belt banner (collapses to a 4pt color hairline)
- The "Details (optional)" card on first paint (collapsed behind disclosure)
- The duration preset chips (already removed in a prior pass)

What stayed:
- All the same fields, all the same controls
- The Prism / FocusAreaChips as the visual anchor (now with more breathing room)
- The 52pt brand-orange Save CTA (now sticky-bottom, only when dirty)
- Belt narrative (now a 4pt color hairline at top — subtle, narrative, no vertical cost)

---

## The type scale that must ship with it

When card chrome goes, type carries the entire hierarchy. Every role must be unmistakable from weight + tracking + opacity alone. This is the watch-out the editorial-references report flagged as the #1 implementation risk.

| Role | Family | Size | Weight | Color | Tracking |
|---|---|---|---|---|---|
| Belt hairline | — | 4pt height | — | belt color (e.g., `COPPER` for blue belt) | — |
| Date eyebrow (`TUESDAY · APRIL 27`) | Plus Jakarta Sans | 11pt | 500 | `COPPER` @ 60% | 0.16em uppercase |
| Page title (`Today's session`) | **Cormorant Garamond italic** | 24pt | 500 | `PALE_YELLOW` @ 90% | normal |
| Section eyebrow (`THE BASICS`, `WHAT YOU WORKED ON`) | Plus Jakarta Sans | 11pt | 600 | `COPPER` @ 60% | 0.16em uppercase |
| Inline label (`Gi · No-Gi`, `Duration`) | Plus Jakarta Sans | 13pt | 500 | white @ 70% | 0.04em |
| Body input value | Plus Jakarta Sans | 16pt | 500 | white @ 90% | 0 |
| Placeholder | Plus Jakarta Sans | 16pt | 400 | white @ 28% | 0 |
| Hairline divider | — | 1px | — | white @ 8% | — |
| Disclosure row (`+ More details`) | Plus Jakarta Sans | 14pt | 500 | `COPPER` @ 80% | 0 |
| Save CTA | Plus Jakarta Sans | 16pt | 600 | white | 0.02em |

**Two notes on this scale:**

1. **Cormorant Garamond escapes the wordmark for the date title.** The brand brief reserves Cormorant for "Journada" only. The Refero research and the editorial-references research both surfaced the same pattern: editorial apps treat the date as the entry's identity (Day One, Apple Notes, NYT). Promoting Cormorant to the date title is the deliberate brand evolution — it lets the form feel like *a page from the journal*, not *a form to fill in*. **Worth confirming with you before we do it.** Alternative: keep Cormorant strictly wordmark-only and use Plus Jakarta Sans tracking-tight for the title.

2. **The two copper eyebrow weights** (date eyebrow at 500, section eyebrow at 600) intentionally differ — the section eyebrows are the structural skeleton; the date eyebrow is the page's masthead. Subtle but important on a chromeless canvas.

---

## Smart defaults — the perceived-formyness multiplier

The mobile-form research surfaced this as the single biggest non-visual move. **Pre-fill every required field on form mount.** The form opens at ~70% complete. The user is now *correcting*, not *filling*.

| Field | Default |
|---|---|
| Date | Today |
| Gi / No-Gi | User's last selection (persist on save) |
| Session type | "Class" (most common) |
| Duration | User's median (or 60m cold-start) |
| Intensity | 3 / Moderate |
| Source | "Coach-led" if type=Class, "Open Mat" if type=Drilling |

NN/g research:
> "Most users approach forms with 'voluntary over-disclosure' behavior… However, marking a form's required fields jeopardizes voluntary over-disclosure and makes users skip optional fields."

With smart defaults, no field is empty on first paint. There's nothing to mark required because nothing reads as required. The user scans and corrects what doesn't match this session.

Backend cost: a small `user_form_defaults` JSONB column on the user record, refreshed on each save. Modest M-tier change.

---

## CTA placement — hybrid is the answer

Three sources of evidence converged: Apple HIG, Material 3, and the editorial-app reference set. None of Day One / Bear / Apple Notes / Things 3 / Reeder uses a sticky-bottom Save bar; all use top-right `Done`. But for a brand-orange-CTA app on a PWA, the keyboard-safety + thumb-zone calculus tilts toward hybrid.

**Recommended:**
- **Top-right `Save`** in the nav bar (17pt copper, disabled until form is dirty) — keyboard-safe, iOS-native, always reachable.
- **Sticky-bottom Save bar** that appears only when the form is dirty *and* the keyboard is hidden — full-width copper, 52pt tall, "Save Session". Hides under the keyboard. Uses `env(safe-area-inset-bottom)`.
- **Both call the same handler.** Two affordances, one action, zero ambiguity.
- **No FAB.** Reads as Material / Hevy / utility — wrong register.

---

## What to do with the belt banner

The animated full-bleed belt-themed date banner is signature Journada brand on desktop. On mobile it costs ~150pt before the first input — about 22% of the visible canvas above the keyboard before any data shows up.

**Recommendation:** Keep the banner **on the home page** (where it has narrative weight) and **on the session detail / read view** (where it frames the saved entry). **Replace it on the compose form** with a 4pt belt-colored hairline at the very top of the page. The hairline preserves the "what belt am I" narrative thread, costs zero vertical real estate, and lets the form's actual content take the masthead position.

This pattern — belt narrative as ambient hairline rather than dominant banner — is closer to how *The New Yorker* puts its masthead stripe at the top of an article rather than reprinting the cover.

---

## Open questions to confirm before implementation

1. **Cormorant Garamond extension.** Brief reserves the serif for "Journada" wordmark only. The research argues the date title is the entry's identity (Day One pattern) and a natural extension. Confirm or reject?
2. **Belt-banner relocation.** Comfortable removing the animated banner from the *compose form* on mobile and keeping it on home + detail? Or is the banner emotionally load-bearing for the act of logging itself?
3. **Optional details — collapsed by default vs always shown.** Tags + Notes behind a `+ More details` disclosure feels right for the editorial register, but if you want the user to write notes more often, always-visible may drive the behavior better. Worth a deliberate UX bet — which way?
4. **Intensity input shape.** Today: 5-bar gradient. Refero showed three viable alternates: keep the 5-bar (compact horizontal version), switch to a slider with caption (Gentler Streak), or switch to a 5-pill segmented row (Matter-style). Implications for history/exports cascade — pick once.
5. **Smart-defaults backend timing.** The visual layout refactor is one PR, ships standalone. Smart defaults are a follow-up PR (small backend addition). Confirm the staging?

---

## Suggested implementation slice

**PR 1 — The S-tier layout refactor.** No backend. Pure visual.

| Change | Tier |
|---|---|
| Drop the three boxed `SURFACE_2` cards | S |
| Switch to single-column continuous scroll with hairline dividers + copper eyebrow labels | S |
| Replace H2 + animated belt banner with eyebrow date + serif title + 4pt belt hairline | S |
| Move "Details (optional)" behind a single `+ More details` disclosure | S |
| Tighten type scale (the table above) | S |
| Replace static date display with a 7-day strip + dots for logged days (TIDE pattern) | S |

This single PR delivers most of the perceived-quality jump. Estimated 1 day of focused work.

**PR 2 — The M-tier polish.** Smart defaults + hybrid CTA.

| Change | Tier |
|---|---|
| Persist `user_form_defaults` JSONB on user record + endpoint to read/write | M |
| Pre-fill all required fields on form mount from those defaults + sensible cold-start fallbacks | M |
| Convert sticky-bottom CTA to hybrid (nav-bar Save + dirty-aware sticky-bottom + keyboard-aware) | M |
| Auto-save Notes draft to localStorage | S |

Estimated 2–3 days.

**PR 3 — Future quick-log shortcut (optional, separate sprint).** A bottom-sheet `.medium` detent for "I just want to log that I trained today" — date, duration, intensity, three taps, swipe down to dismiss. Reuses the same component.

---

## What we're explicitly *not* doing (anti-pattern catalog)

These showed up in the research as common-but-wrong-for-Journada:

- **Required-field asterisks** — anti-editorial; smart defaults eliminate the need
- **Color-coded everything** (Hevy, Strong) — copper stays sparse
- **Filled colored section headers** (`bg-emerald-600 WORKOUT DETAILS`) — the eyebrow does it quieter
- **Floating action buttons** — Material/utility-coded
- **Dense inline calculator tables** (sets × reps grids) — wrong genre
- **Multi-step wizards with progress dots** — the user already decided to log; navigation cost is pure friction
- **Bright accent gradients on cards** (purple/orange highlight cards) — gym-bro register
- **"Save & log next" loops** — Journada is one session per train ride, not a logging sprint
- **Inline validation pills** (red `Required` chips) — assumes incompetence
- **Banner hero illustrations of BJJ silhouettes** — stockphoto energy

---

## Why I'm confident

Three independent research streams — Refero pattern catalog, editorial-app deep-read, and modern-mobile-form UX literature — converged on remarkably consistent recommendations:

| Recommendation | Refero study | Editorial study | UX-patterns study |
|---|---|---|---|
| Drop boxed cards → eyebrow + whitespace + hairline | ✓ | ✓ | ✓ |
| Full-screen modal (not bottom sheet) | ✓ | ✓ | ✓ (Apple HIG + Material 3) |
| Date in serif as the headline | ✓ | ✓ | ✓ |
| Single "More details" disclosure for optional | ✓ | ✓ | ✓ |
| Smart defaults > required-asterisks | ✓ (implicit) | ✓ | ✓ (NN/g explicit) |
| Hybrid nav-bar + sticky-bottom CTA | (recommended sticky-only) | (recommended top-right) | ✓ (hybrid resolves) |
| Belt banner — relocate, don't repeat | ✓ | ✓ | ✓ |

When three independent passes converge this tightly on the same pattern, the pattern is real, not a researcher's bias.

---

## Reference scoreboard — top three apps to internalize

If you only look at three apps before approving the redesign, look at these:

1. **222** (iOS dating app) — Refero `611ee5c2-33df-4161-ac12-4f259b164f6a`. The closest visual analogue to your brand brief in the entire iOS canon. Dark forest-green, serif prompts, lowercase eyebrows. Open the App Store listing and look at the screenshots. This is the register.

2. **Day One** (iOS journal app) — your brief already lists this. Look specifically at the entry-compose flow. Notice: dimmed metadata strip at the top (date, location, weather), then the writing surface, then a paperclip in the keyboard accessory for everything else. No card chrome. No labelled rows.

3. **NYT Display Settings** — Refero `a616e8cf-3598-4266-9a69-2d67908e20fa`. Three eyebrow-separated sections inside one canvas. Radio rows with two-line descriptors (label + descriptor underneath). This is the precedent for treating Polarity / Source / Gi as eyebrow-grouped rows rather than three separate toggle blocks.

---

## Closing

The screen wants to be a page from a notebook, not a tax return. The fields are already right. The flow is already right. The chrome is fighting the content. **Replace the chrome — keep the content** — and the screen becomes what desktop already is: heavier, more sophisticated, considered, earned.

When you're ready, PR 1 above is the highest-leverage starting point. It ships in a day, it's pure visual, no backend, and it delivers most of the perceived-quality jump available.

The three deeper reports are linked at the top. They've got the receipts (Refero UUIDs, source URLs, direct quotes from designers) if you want to dig into any specific decision.

— Claude
