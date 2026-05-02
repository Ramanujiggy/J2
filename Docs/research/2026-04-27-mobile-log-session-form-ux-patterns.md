# Mobile-First Form UX Patterns for the Journada Log-Session Flow

**Date:** 2026-04-27
**Author:** Research notes (Claude)
**Audience:** Journada product / design (Robert)
**Scope:** Design research only. No implementation.
**Subject:** Redesigning the mobile log-session compose flow (the "log a training session" form) to match the editorial register Journada has earned on desktop.

---

## Executive summary

Today's mobile log-session screen uses three vertically-stacked, separately-bordered SURFACE_2 cards ("The Basics", "What did you work on?", "Details (optional)") sitting on a full-screen page. The user's instinct is right — that pattern reads as "form" rather than "journal entry", and on a phone the boxed cards add chrome that competes with the content.

The dominant 2025 consensus across Apple HIG, Material 3, Nielsen Norman Group, and the premium app reference set is:

1. **Container:** A full-screen modal (push-page equivalent) is correct for a "complex form that benefits from full-screen presentation"; bottom sheets are *not* recommended for "complex workflows or forms that require extensive user input." Detent-resizable sheets are good for *quick* compose only.
2. **Sectioning:** Drop the boxed cards. Use a single-column continuous scroll with hairline dividers and small eyebrow labels — implicit containment via whitespace, not explicit containment via cards.
3. **Hierarchy:** Required fields above the fold with smart defaults pre-filled; optional fields collapsed under a single "More details" disclosure; never a wizard for this flow — wizards win on lead-gen, not on logging where the user already knows the data.
4. **Header:** A subtle eyebrow ("Tuesday, April 27") plus the first input acting as the hero. Skip the belt-banner on mobile where vertical space is at a premium; promote the date to the eyebrow and use that retrieved real estate for the actual session content.
5. **CTA:** Hybrid — top-right "Save" in the nav bar (iOS-native, keyboard-safe) plus a sticky bottom Save bar that appears once the form is dirty. Do **not** use a FAB; FABs read as Material/utility, not editorial.

A short Recommendation Matrix and per-recommendation effort tier are at the bottom (sections 8 and 9).

---

## Section 1 — Container shell: full-screen vs sheet vs push-page

### What Apple says (2025)

Apple's HIG distinguishes "sheets" from "full-screen modals" by the user's intent:

> "A sheet helps people perform a scoped task that's closely related to their current context."
> "Use a full-screen modal view when you need to capture attention for an extended interaction… for immersive content… or a complex task that benefits from a full-screen presentation, such as marking up a document or editing a photo."

— Apple HIG, "Sheets" / "Modality" pages.

Presentation detents (`.medium`, `.large`, custom `.fraction(0.25)`, `.height(200)`) shipped with iOS 16 and matured through iOS 17/18. Apple's own apps use them for *secondary* tasks (the share-sheet, Maps search, Stocks watchlist editor) — not for primary compose flows. Mail's compose is still a full-screen sheet (slides up from the bottom, takes the full screen, owns its own nav bar).

### What Material 3 says

Material 3's bottom-sheet guidance is explicit:

> "The ModalBottomSheet is excellent for quick, contextual actions or displaying supplementary information. For more complex workflows or forms that require extensive user input, consider navigating to a dedicated screen instead."

— Material 3 / Composables docs.

So Material agrees: long forms get a dedicated screen, not a sheet.

### What premium apps actually do

| App | Container for compose |
|---|---|
| Day One | Full-screen modal sliding up; own nav bar (Cancel left, Done right) |
| Bear | Full-screen push from notes list; circular new-note FAB triggers it (Bear is the exception that proves the rule — the *trigger* is FAB-y, but the compose surface itself is full-screen) |
| Things 3 | Two surfaces: a small inline bottom sheet for "Quick Add" (title + notes only), and a full-page edit screen for the rich form |
| Apple Health (Add Data) | Full-screen modal sheet |
| Strava (Record / Save Activity) | Full-screen page after the workout, single-column scroll |
| Hevy / Strong | Full-screen workout view that takes over the app while logging (these are timer-driven, not really "forms") |
| Whoop Journal (post-2025 redesign) | Full-screen entry, scrollable, segmented sections |

### Recommendation for Journada

**Full-screen modal** (slide-up sheet that becomes full-screen on iPhone — the SwiftUI `.sheet` default without detents, or a Capacitor-equivalent). Reasons:

- Journada's log-session form has 9 inputs with rich interactions (chip modes, polarity, tag typeahead, voice-notes). That's not "scoped" per HIG — it's an extended interaction.
- The slide-up motion frames it as a *moment*, not a destination, which matches the journaling register better than a hard navigation push.
- Reserve detent bottom sheets for the *Quick Log* shortcut you'll likely add later (date + duration + intensity, three taps, swipe down to dismiss) — that's the right home for `.medium` detent.

Avoid: inline expansion (fights the editorial frame), tabbed sub-form (no real categories to tab between), and wizard (see Section 2).

**Sources:**
- Apple HIG, [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) and [Modality](https://developer.apple.com/design/human-interface-guidelines/modality).
- [Bottom Sheets vs Fullscreen Modals — Design for Native](https://designfornative.com/bottom-sheets-vs-fullscreen-modals/).
- [Material 3 Bottom Sheets](https://m3.material.io/components/bottom-sheets) and [Composables docs](https://composables.com/material3/modalbottomsheet).
- [Mastering presentationDetent in SwiftUI — Wesley Matlock](https://medium.com/@wesleymatlock/mastering-presentationdetent-in-swiftui-a-comprehensive-guide-ce75eab8c508).

---

## Section 2 — Sectioning: boxed cards vs continuous scroll vs progressive disclosure vs wizard

### What the research says

Three converging findings:

1. **Multi-step (wizard) forms convert higher than single-page forms — but only for forms users don't *want* to fill in.** The cited 14%–86% conversion lift comes almost entirely from lead-gen, checkout, and signup studies (Vendio, Growform, WeWeb). Logging in a journal is the opposite case: the user has already decided to log; the form just has to get out of the way.

2. **Long unstructured scroll causes cognitive load; sectioned-but-not-boxed scroll does not.** NN/g and Baymard agree:
   > "Long, unstructured scrolling increases cognitive load and overwhelms users, while structured and segmented content helps reduce this mental strain… Divide long content into smaller sections with clear headings and visuals."
   The structure is the mental win. The *boxes* are not.

3. **Implicit containment beats explicit containment for editorial register.** Material 3's content-structure guidance distinguishes "implicit containment" (whitespace + typography) from "explicit containment" (cards + dividers). Editorial products almost always use implicit; utility products use explicit.

### The boxed-card cost

Three SURFACE_2 cards on mobile cost roughly:
- ~16px outer margin × 2 = 32px lost horizontal width.
- ~12–16px card padding × 2 = 24–32px lost width inside.
- Border + shadow draws the eye to the *frame* instead of the field.
- The card label ("The Basics") becomes the visual hero, when the actual data should be.

On a 390pt-wide iPhone canvas, that's roughly 60pt of width burned per row to chrome that adds nothing.

### Recommendation for Journada

**Single-column continuous scroll with hairline dividers and small uppercase eyebrow labels** — not boxes. Keep all three current section labels ("The Basics", "What did you work on?", "Details") but render them as 11px copper-colored eyebrow text above a hairline separator, not as card headers. Spacing recipe:

- 24px between fields inside a section.
- 40px (1.25× section gap) between sections, with a 1px hairline at 8% opacity sitting in that gap.
- 16px outer page margin only — let inputs fill the canvas.
- "Details (optional)" stays at the bottom and is **collapsed by default** behind a single tap-to-expand row (see Section 3).

This is the layout pattern Day One, Apple Notes, Bear, and (post-redesign) Strava all use. It reads as a page in a notebook, not a form.

**Why not a wizard:** wizards add navigation cost (back, next, progress dots) for a flow the user is doing in 60 seconds on a train. Wizards also break the "scan and edit anything" ergonomic — if the user got intensity wrong on step 2 and they're now on step 4, they have to back-navigate, which feels like a checkout, not a journal.

**Why not an accordion (multiple collapsed sections):** double-disclosure (collapse + expand for each section) adds taps for the *required* fields. Use a single disclosure for *optional only*.

**Sources:**
- [Designing for the Impatient Scroll — 2025](https://www.portotheme.com/designing-for-the-impatient-scroll-7-mobile-ux-rules-you-should-actually-care-about-in-2025/).
- [Mobile UX Trends 2025 — Baymard](https://baymard.com/blog/mobile-ux-ecommerce).
- [Mastering the UX Law of Chunking — Miller's Law](https://medium.com/@shakindikithmini/mastering-the-ux-law-of-chunking-simplify-information-for-better-usability-62445e62f3d0).
- [Single-column beats multi-column forms — Foxit](https://www.foxit.com/blog/elements-of-good-form-design-single-column-beats-multi-column-forms/).
- [Multi-step form conversion lift — Webstacks 2025](https://www.webstacks.com/blog/multi-step-form) (caveat: lead-gen context).

---

## Section 3 — Field hierarchy: 10 fields, only 4 matter

### The four required, the six optional

For Journada's flow:

- **Required (above the fold, pre-filled where possible):** Date (default = today), Gi/No-Gi, Session type, Duration.
- **Required-but-easy (mid-fold):** Intensity, Pillar focus chips.
- **Optional / contextual:** Polarity (only conditionally), Source, Tags, Notes.

### What premium apps do

- **Day One** pre-fills date, time, and location, and treats them as compact metadata at the *top* of the editor, in dimmed type. The user can tap any of them to override, but visually they fade — they're "settled" by default.
- **Things 3** uses "Show more options" behind an explicit toggle for tags, deadline, and checklist, putting only Title and Notes upfront.
- **Apple Reminders** collapses date/time/location/tags behind a single "Details" affordance.
- **Strava (post-redesign)** shows only Sport + Title above the fold; description, photos, gear, perceived exertion, privacy are all in a collapsed "Edit details" surface or pre-filled with smart defaults.

### What NN/g says about marking required

> "Mark all the required fields. Be as explicit and transparent as possible."

But two caveats from the same body of research:

> "Most users approach forms with 'voluntary over-disclosure' behavior… However, marking a form's required fields jeopardizes voluntary over-disclosure and makes users skip optional fields."

And:

> "Disclosures should not include any required information in the hidden content, as it can cause user confusion or validation errors."

— [NN/g — Marking Required Fields in Forms](https://www.nngroup.com/articles/required-fields/).

### Recommendation for Journada

Three layered moves:

1. **Smart defaults for everything required.** Date = today. Gi/No-Gi = whichever the user chose last time (per-user persisted default). Session type = "Class". Duration = the user's median (or 60 if cold-start). Intensity = 3. Source = "Coach-led" if session type is "Class", "Open Mat" otherwise. *The form opens as if 70% complete already.* This is the single biggest perceived-formyness reduction available.
2. **No required-asterisks needed.** Because all required fields are pre-filled and sit above the fold, there's nothing to mark — every visible field already has a value. The user is editing, not filling.
3. **Optional fields under a single "More details" toggle.** Tags, Notes, Source-toggle, and Polarity (when not conditionally surfaced) live under one tap. The toggle row reads: `+ More details` with a small copper chevron. When expanded, the layout extends inline; the sticky CTA stays put. Polarity stays *conditionally inline* (not in the disclosure) because it's situationally required — appearing under the chip grid when guard or pins is the focus, as today.

**Anti-pattern to avoid:** dimming optional labels but still rendering all fields. That just looks like a form with low-contrast text. Either show the field with strong type, or hide it entirely.

**Sources:**
- [NN/g — Marking Required Fields](https://www.nngroup.com/articles/required-fields/).
- [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- [LogRocket — Progressive disclosure in UX design (2025)](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/).
- [UX Movement — Why users fill out less if you mark required](https://uxmovement.com/forms/why-users-fill-out-less-if-you-mark-required-fields/).

---

## Section 4 — Header / hero treatment

### Patterns surveyed

| Pattern | Where it shows up | Fit for Journada? |
|---|---|---|
| Big editorial H1 ("New Entry") | Notion, Substack compose | Too declarative; the H1 takes weight from the actual content |
| Compact app-bar (back/title/save) | Mail compose, iMessage | Functional, but bland; loses the editorial moment |
| Hero illustration / animation | Onboarding, paywalls | Wrong register for compose |
| **First input *is* the hero** | Day One, Bear, Apple Notes, iA Writer | Strong fit |
| Subtle eyebrow + small title | Stripe Press, Linear, Things 3 | Strong fit |

### The current belt banner — should it survive on mobile?

The belt-themed full-bleed banner with the date is signature Journada brand on desktop. On a 390pt mobile canvas it has two costs:
- Vertical space: a 96–128pt banner on top of a 56pt nav bar means ~150–180pt before the user sees their first input. That's roughly 22% of the visible canvas above the keyboard before any data.
- Brand inflation: brand assets have diminishing returns when repeated on every form. Day One uses a date-banner only on the *journal home*, not on the compose screen.

### Recommendation

**Replace the mobile banner with a two-line header:**

```
Tuesday, April 27          [eyebrow, 11px copper, all-caps]
Log session                [22px ivory, editorial serif or weight-medium sans]
```

Then immediately the form. On scroll, collapse to a sticky `[Cancel] Log session [Save]` 44pt nav bar. Reserve the belt-banner for the journal-home and the entry-detail view, where it has narrative weight.

If the user objects to losing the belt motif here entirely: keep a 4pt copper hairline at the top of the page, color-shifted to belt color of the user's rank. Subtle, narrative, no vertical cost.

**Sources:**
- [Editorial App designs — Dribbble curation](https://dribbble.com/tags/editorial_app).
- [Best Dark Mode UI Design 2025](https://www.uinkits.com/blog-post/best-dark-mode-ui-design-examples-and-best-practices-in-2025).
- [Bear — minimal compose UI](https://bear.app/) and [TapSmart on Bear's design](https://www.tapsmart.com/features/classics-bear/).

---

## Section 5 — CTA placement: sticky-bottom vs nav-bar vs hybrid

### What the research says

UX Movement (a frequently-cited mobile-form research source):

> "Users often miss submit buttons placed in the action bar, and they also miss save buttons in the action bar and exit forms without saving their settings… As they fill out the form, their eyes move from the top of the page to the bottom. When they complete it, their eyes are at the bottom of the page."

— [UX Movement — Why users miss form buttons in the action bar](https://uxmovement.com/mobile/why-users-miss-form-buttons-placed-in-the-action-bar/).

But for *modal forms specifically*:

> "Both Android and iOS apps have buttons at the top so that users don't have to close the keyboard before they can hit the 'submit' button. For filling out forms or performing complex edits within a modal, buttons at the top are recommended."

— same source.

And specifically for in-browser web on iOS, sticky-bottom is hostile:
> "A tap at the bottom of the screen in Safari on an iPhone brings up the app tool bar."

### Reconciling

The tension: nav-bar Save is keyboard-safe and iOS-native; sticky-bottom Save is more discoverable. Both have evidence behind them.

The hybrid resolves it. This is what Mail, Notes, Day One, and Apple Reminders all do:

- **Top-right "Save" / "Done"** in the nav bar — always present, keyboard-safe.
- **Sticky bottom CTA** — appears only when form is dirty *and* keyboard is hidden. Disappears under the keyboard. On a PWA, this avoids the Safari toolbar collision because the CTA is a flexbox child of the page, not a `position: fixed` overlay; if you must use fixed, use `viewport-fit=cover` + `env(safe-area-inset-bottom)`.

### Recommendation for Journada

**Hybrid: nav-bar Save (right) + sticky bottom Save bar (appears on dirty, hides on keyboard).**

- Top-right Save: 17pt copper text, disabled until form is dirty.
- Bottom bar: full-width copper button, 56pt tall, "Save session" label. Sits in the thumb-comfort zone.
- Both call the same handler. Two affordances, one action, zero ambiguity.

Avoid: FAB (wrong register, Material/Hevy-coded) and inline-end-of-form (requires scroll, increases drop-off when the keyboard pops up).

**Sources:**
- [UX Movement — Optimal placement for mobile CTAs](https://uxmovement.com/mobile/optimal-placement-for-mobile-call-to-action-buttons/).
- [UX Movement — Why users miss form buttons in the action bar](https://uxmovement.com/mobile/why-users-miss-form-buttons-placed-in-the-action-bar/).
- [GoodUI Pattern #41 — Sticky CTA](https://goodui.org/patterns/41/).

---

## Section 6 — Reference flows from premium apps

### Day One (journal compose)

- **Container:** full-screen sheet from the bottom. Cancel left, Done right.
- **Header:** dimmed metadata strip — date, time, location, journal selection — sits above a single multi-line text body.
- **Sectioning:** none visually. The body is the form. Photos, audio, tags, weather are tucked behind icon affordances in a bottom toolbar.
- **CTA:** "Done" in the top-right; auto-save on dismiss.
- **Takeaway for Journada:** the *metadata as dimmed strip at top* pattern is gold for our date / Gi / type / duration block. Don't lay them out as labeled inputs — lay them out as a metadata row the user can tap to edit.

### Bear (compose)

- **Container:** full-screen push.
- **Header:** none. The first line of the document *is* the title.
- **Sectioning:** none. Pure document.
- **CTA:** none — auto-save on every keystroke.
- **Takeaway:** auto-save is a luxury we should consider for the Notes field at minimum (avoid losing what they typed on the train if a tab swap kills the PWA).

### Things 3 (quick add + full edit)

- **Two-tier compose:** a compact bottom-sheet quick-add (title + notes), and a full-page edit screen with "Show more options" disclosing tags / deadline / checklist.
- **Takeaway:** validates the two-tier pattern (Quick Log later for Journada) and the single-disclosure for optional fields.

### Apple Health (Add Mindful Minutes)

- **Container:** full-screen modal sheet.
- **Form:** start time, end time, source — three fields, single-column, hairline dividers, no card chrome.
- **CTA:** "Add" top-right.
- **Takeaway:** Apple's own template for "log a thing that already happened" is explicitly chrome-less and CTA-in-nav-bar.

### Apple Fitness (Add Workout / custom workout)

- **Container:** full-screen.
- **Form:** Activity type chips at the top, then duration, then distance, then calories — pre-filled smart defaults.
- **Takeaway:** the *chip-row at the top* is a strong precedent for our session-type segmented control. Apple does it without any card or border.

### Strava (Record → Save)

- **Container:** full-screen save screen after the activity.
- **Form:** Title (auto-generated, editable), Sport, Description (optional), then a row of toggles (perceived exertion, privacy, gear).
- **CTA:** orange Save button at the bottom, sticky.
- **Takeaway:** orange-Strava is allowed to have a sticky bottom CTA because their brand owns the color. Copper-Journada can do the same.

### Hevy / Strong (workout log) — what to avoid

- **Container:** full-screen, but designed as a *live* logging surface (rest timers, set checkmarks, plate counters).
- **Aesthetic:** dense, table-heavy, gym-utility colors.
- **Takeaway:** these are not journals — they're calculators. Journada should not borrow their density, their tab structure, or their accent-everything color schemes.

### Whoop Journal (post-2025 redesign)

- **Container:** full-screen entry, scrollable.
- **Form:** segmented toggles (yes / no / skip) on dozens of behaviors; minimal labels, generous whitespace.
- **Takeaway:** segmented controls work at scale when there's enough vertical air. Whoop earns it with whitespace, not chrome.

**Sources:**
- [Day One App Store](https://apps.apple.com/us/app/day-one-daily-journal-diary/id1044867788) and [Day One releases](https://dayoneapp.com/releases/).
- [Bear — Markdown Notes](https://bear.app/) and [The Sweet Setup on Bear](https://thesweetsetup.com/apps/the-best-note-taking-apps-for-ios/).
- [The Sweet Setup — Capturing Tasks in Things 3](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/).
- [Strava — Redesigned Record Experience](https://press.strava.com/articles/strava-launches-redesigned-record-experience).
- [Whoop — Everything Launched in 2025](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/).

---

## Section 7 — Anti-patterns (what gym-bro / utility apps do that Journada must avoid)

1. **Color-coded everything.** Hevy, Strong, MyFitnessPal accent every label, every button, every chip with brand orange/green/red. Reads as utility/dashboard. Journada uses copper *sparingly* — primary CTA, focus rings, the brand hairline. Everything else is ivory-on-forest.
2. **Dense tables / inline calculators.** Sets × reps × weight grids feel correct for lifting because the data is mathematical. Grappling sessions are *narrative*. Don't import the table.
3. **Required-field asterisks on a journal form.** Asterisks signal "this is a transaction with consequences." A journal entry has no consequences except its own existence. Smart defaults remove the entire need for the convention.
4. **"Save & add another" / "Save & log next set" pattern.** Hevy lives on this. Journada's user logs *one* session per train ride home. The next-action affordance after save should be: "Saved. ← Back to journal," not a re-open.
5. **Modal-on-modal stacks.** When tag-picker is a modal, then date-picker is a modal on top of that, the user loses the editorial frame. Use inline-expanding rows where possible (date picker drops down inline; tag picker pushes a full-screen sub-sheet only when the user is genuinely searching, not for the canonical-pillar case).
6. **Banner headers with hero illustrations of "training" or "BJJ" silhouettes.** Stockphoto-energy. A typographic eyebrow does the work with no asset cost.

---

## Section 8 — Recommendation matrix for Journada

| Decision | Recommendation | Reference apps | Tradeoffs |
|---|---|---|---|
| Container | Full-screen modal (slide-up sheet) | Day One, Apple Health, Mail | Loses the "swipe to dismiss to half" affordance; gain the editorial frame |
| Sectioning | Single-column continuous scroll, hairline dividers, copper eyebrow labels | Bear, Apple Notes, Strava save screen | Loses explicit "card" grouping; gains 60pt horizontal space + editorial register |
| Optional fields | Single "More details" disclosure at the bottom | Things 3, Apple Reminders | Adds one tap for tags/notes; saves four fields of vertical scroll for users who don't fill them |
| Hierarchy | Smart defaults for all required fields, no asterisks, optional-collapsed | Day One, Apple Fitness, Strava | Requires per-user default persistence (small backend addition) |
| Header | Eyebrow date + small "Log session" title; collapse to sticky 44pt nav-bar on scroll | Linear, Stripe Press, Things 3 | Loses the belt banner on this screen specifically (keep on home / detail) |
| CTA | Hybrid: nav-bar Save (right) + sticky-bottom Save when dirty | Mail, Apple Notes, Day One | Two affordances feels redundant on first read; in practice it's keyboard-safe + thumb-zone-friendly |
| Belt narrative | Replace banner with 4pt belt-color hairline at top | (Journada-specific) | Subtle is the goal — belt color stays, vertical cost goes |
| Pillar chips | Keep the 5-chip grid; remove its card border; raise contrast on the long-press "deep work" state with a copper inset ring instead of a fill | Apple Fitness chip row, Whoop toggles | Long-press discoverability remains a concern — needs an onboarding hint on first use |
| Polarity | Stay conditionally inline under chip grid | (current behavior) | Conditional inline = good; do not move to disclosure |
| Notes field | Auto-save draft to localStorage on every keystroke | Bear, Apple Notes | Tiny implementation cost, big trust win on a flaky train connection |
| Voice-to-text | Native button inside the textarea, copper mic icon, not a card-full toolbar | iMessage dictation, Apple Notes | Already native to iOS keyboard; surface the brand-colored hint, don't reinvent |

---

## Section 9 — Implementation difficulty estimates

Tiers: S = small (≤1 day), M = medium (2–4 days), L = large (>1 week).

| Recommendation | Tier | Notes |
|---|---|---|
| Drop the three boxed cards; switch to single-column + hairline dividers | **S** | Pure CSS / Tailwind class swap. Removing borders, adjusting spacing tokens. Biggest perceived-quality win for least code. |
| Replace mobile belt-banner with eyebrow + small title (keep belt hairline) | **S** | Component-level change. Keep the banner component for home/detail. |
| Move "Details (optional)" to a `<details>` / disclosure toggle | **S** | Native `<details>` + a small chevron animation. Maybe 50 lines. |
| Smart defaults (date = today, type = Class, duration = median, intensity = 3, Gi = last-used) | **M** | Backend: persist `user_form_defaults` JSONB on the user record, refresh on each save. Frontend: pre-fill on form mount. Median duration may need a small SQL helper. |
| Hybrid CTA (nav-bar Save + sticky-bottom Save when dirty + keyboard-aware) | **M** | Nav-bar Save is small. Sticky-bottom needs `env(safe-area-inset-bottom)` and a `visualViewport` listener to hide on keyboard. Form-dirty state is trivial in your existing form lib. |
| Auto-save Notes draft to localStorage | **S** | Debounced effect, ~30 lines. |
| Conditional Polarity rendering (already today) | **S** | Already implemented; verify it survives the layout refactor. |
| Long-press "deep work" affordance — copper inset ring | **S** | Tailwind `ring-inset ring-copper-500` on the deep-work state class. |
| Quick Log bottom-sheet (future, separate flow) | **L** | New entry point, new sheet component, new abbreviated submission path, telemetry. Out of scope for this iteration — captured as a follow-up. |
| Per-user default persistence backend | **M** | Migration + endpoint + writeback on save. |

**Suggested sprint slice:** ship S-tiers and the layout refactor first (one PR; no backend changes; the perceived quality jump is most of the win). Then add smart defaults and the hybrid CTA in a second PR. Quick-Log is a separate sprint.

---

## Closing note

The user's instinct ("too formy") is correct, and it's correctable without a structural rewrite. The form has the right *fields*. It has the right *flow*. What it doesn't have is the right *frame*: it's wearing utility-app chrome (boxed cards, labeled groups, banner hero) on top of editorial content. Replace the chrome — keep the content — and the screen will feel like a page in a leather notebook, not a tax return.

The two patterns to internalize from this research:
1. **Implicit containment over explicit containment.** Whitespace + typography, not borders + cards. Every premium reference does this.
2. **Smart defaults over asterisks.** A journal form should open as if the user has already filled most of it in. The user's job is to *correct*, not *complete*.

---

## Consolidated source list

- Apple HIG, [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- Apple HIG, [Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- Apple Developer, [presentationDetents(_:)](https://developer.apple.com/documentation/swiftui/view/presentationdetents(_:))
- Material Design 3, [Bottom Sheets](https://m3.material.io/components/bottom-sheets)
- Composables, [ModalBottomSheet — Material 3](https://composables.com/material3/modalbottomsheet)
- NN/g, [Marking Required Fields in Forms](https://www.nngroup.com/articles/required-fields/)
- NN/g, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- NN/g, [Few Guesses, More Success — Reducing Cognitive Load in Forms](https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/)
- NN/g, [Minimize Cognitive Load to Maximize Usability](https://www.nngroup.com/articles/minimize-cognitive-load/)
- LogRocket, [Progressive Disclosure in UX Design (2025)](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- Baymard, [Mobile UX Trends 2025](https://baymard.com/blog/mobile-ux-ecommerce)
- Porto Theme, [7 Mobile UX Rules — Designing for the Impatient Scroll (2025)](https://www.portotheme.com/designing-for-the-impatient-scroll-7-mobile-ux-rules-you-should-actually-care-about-in-2025/)
- Foxit, [Single-column beats multi-column forms](https://www.foxit.com/blog/elements-of-good-form-design-single-column-beats-multi-column-forms/)
- Webstacks, [Best Multi-Step Form Examples 2025](https://www.webstacks.com/blog/multi-step-form)
- UX Movement, [Optimal placement for mobile CTAs](https://uxmovement.com/mobile/optimal-placement-for-mobile-call-to-action-buttons/)
- UX Movement, [Why users miss form buttons in the action bar](https://uxmovement.com/mobile/why-users-miss-form-buttons-placed-in-the-action-bar/)
- UX Movement, [Why users fill out less if you mark required fields](https://uxmovement.com/forms/why-users-fill-out-less-if-you-mark-required-fields/)
- GoodUI, [Pattern #41 — Sticky Call to Action](https://goodui.org/patterns/41/)
- Design for Native, [Bottom Sheets vs Fullscreen Modals](https://designfornative.com/bottom-sheets-vs-fullscreen-modals/)
- Wesley Matlock, [Mastering presentationDetent in SwiftUI](https://medium.com/@wesleymatlock/mastering-presentationdetent-in-swiftui-a-comprehensive-guide-ce75eab8c508)
- Lisa Li, [Native iOS Design Pattern — Modals and Sheets](https://medium.com/@jiachunl/native-ios-design-pattern-modals-and-sheets-22b5929d1429)
- Sammi Su, [When to Use Bottom Sheets vs Full Screens](https://medium.com/@sammi121313/when-to-use-bottom-sheets-vs-full-screens-a5a2393878c5)
- Day One, [App Store listing](https://apps.apple.com/us/app/day-one-daily-journal-diary/id1044867788) and [Release notes](https://dayoneapp.com/releases/)
- Bear, [Official site](https://bear.app/) and [TapSmart feature on Bear](https://www.tapsmart.com/features/classics-bear/) and [The Sweet Setup on Bear for iOS](https://thesweetsetup.com/apps/the-best-note-taking-apps-for-ios/)
- The Sweet Setup, [Capturing Tasks in Things 3 for iPad and iPhone](https://thesweetsetup.com/a-guide-to-capturing-tasks-in-things-3-for-ipad-and-iphone/)
- Strava Press, [Redesigned Record Experience (July 2025)](https://press.strava.com/articles/strava-launches-redesigned-record-experience)
- Whoop, [Everything WHOOP Launched in 2025](https://www.whoop.com/us/en/thelocker/everything-whoop-launched-in-2025/)
- Hevy, [Workout Tracker — App Store](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350)
- Career Foundry, [Miller's Law in UX Design — 2025 Guide](https://careerfoundry.com/en/blog/ux-design/what-is-millers-law/)
- Shakindi Kithmini, [UX Law of Chunking](https://medium.com/@shakindikithmini/mastering-the-ux-law-of-chunking-simplify-information-for-better-usability-62445e62f3d0)
- Elaris Software, [Mobile App UX — Designing for Thumb Zones (2025)](https://elaris.software/blog/mobile-ux-thumb-zones-2025/)
- Smashing Magazine, [The Thumb Zone — Designing for Mobile Users](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)
- UI Kits, [Best Dark Mode UI Design Examples 2025](https://www.uinkits.com/blog-post/best-dark-mode-ui-design-examples-and-best-practices-in-2025)
- IvyForms, [Form Layout Best Practices for Higher Conversions](https://ivyforms.com/blog/form-layout-best-practices/)
- Tinyform, [2025 Mobile Form Statistics & UX Trends](https://tinyform.com/post/mobile-form-statistics-ux-trends)
