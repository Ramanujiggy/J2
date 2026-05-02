# Mobile Log Session — Refero Pattern Research

**Date:** 2026-04-27
**Author:** Design research pass for the Journada mobile LogSessionForm redesign
**Status:** Research artifact — not implementation guidance

## Context

The current mobile `LogSessionForm` stacks three distinct boxed `SURFACE_2` cards ("The Basics," "What did you work on?," "Details (optional)"), each ringed with its own border and labeled with an uppercase eyebrow, beneath an H2 page title and a full-bleed animated belt-themed date banner. The user reports the screen feels like "three separate submodels, a lot going on there" — i.e. the visible plurality of containers is fragmenting an experience that should read as one continuous, considered act of journaling.

The desktop version is already landing in the right register: heavier, sophisticated, leather-notebook-meets-Claude-interface. The job is to bring that same gravitas to mobile without simply shrinking the desktop layout. This document catalogs how 50+ real iOS apps in adjacent categories (workout logging, journaling, meditation tracking, editorial reading) handle the *form-as-genre* problem on a 375px screen, with explicit attention to the premium / editorial register Journada lives in.

## 1. Top references

Each entry below is a screen Refero indexed that exemplifies a pattern worth borrowing or explicitly rejecting. UUIDs are listed so they can be revisited at `https://refero.design/screens/<uuid>`.

### 1.1 Train Fitness — "Generate Workout" config form
- **UUID:** `e436522c-e413-46d5-9518-6e6b64bdef65`
- **What it is:** A full-screen dark-mode configuration form with X close, centered title, and a vertically stacked single-column form. Each row uses a left-aligned label with a right-aligned input affordance (dropdown chevron, pill stepper, or chevron-row). No boxed sub-cards. Sections are separated only by an uppercase gray eyebrow ("ADD MORE INFORMATION") and whitespace. Primary CTA "Generate" is a pinned bottom button.
- **Why premium-adjacent:** It uses the *iOS Settings grouped-list* idiom (which Apple uses for nearly every system form) but applies it to a content-creation flow. Hierarchy is carried entirely by typography weight and a single accent color.
- **Screenshot would show:** Page title centered top, a status-prompt card, then five form rows separated by hairlines, then an inline disclosure ("Advanced Settings"), then a labeled multiline notes field, then a sticky CTA.

### 1.2 Train Fitness — Workout Summary settings
- **UUID:** `e5e700ef-c6b6-441f-b6a6-632f836acb9b` and `6e5896fd-c023-4a7d-a449-06ec5480b838`
- **What it is:** The post-workout review screen organized into THREE labeled groups ("WORKOUT LOG", "PRIVACY", "ADVANCED") rendered as iOS-style grouped lists — *not* boxed cards. The groups are visually separated by gray uppercase tracking-widest eyebrows above whitespace. A single rounded container holds each group's rows.
- **Why critical:** This is exactly what Journada needs — three logical groups, but rendered as one page that breathes. Each row is a label + value affordance (chevron, dropdown, stepper, switch). The "How was your workout?" thumbs prompt and big white "Done" button anchor the bottom.
- **Pattern transfer:** Replace the user's three SURFACE_2 boxes with three eyebrow-separated grouped-list sections inside a single canvas.

### 1.3 The Outsiders — Workout Type bottom sheet
- **UUID:** `3372f5ce-118e-4385-9ebf-beee4ae3c516`
- **What it is:** Heavy frosted-glass bottom sheet (~75% screen height) with a centered serif-feeling display title, two grouped sections separated by uppercase eyebrows ("YOUR WORKOUTS", "ALL WORKOUT TYPES"), thin 1px hairline dividers between rows, and a sticky pill CTA at the bottom.
- **Why premium:** The frosted backdrop creates physical layering; the sheet itself uses a single dark surface (`#1B1B1C`) with no internal boxes — hierarchy comes entirely from eyebrow + hairline + radio affordance. This is closest in spirit to the seigaiha-leather brief.

### 1.4 Day One / ABY Journal — Templates picker
- **UUID:** `63405991-5973-4b85-99c1-5ee6afb73f01`
- **What it is:** Dark modal with a 2x2 template grid. Each template shows a real-looking handwritten preview underneath the title, a quiet "More coming soon..." caption beneath. The chrome around it (segmented "Suggestions / Scan / Guided / Templates") is pill-thin and feels editorial.
- **Why for Journada:** The handwritten preview lines inside each card is the most "leather notebook" affordance found in the entire research set — close cousin to the seigaiha texture in the brief.

### 1.5 Kin — AI assistant home with serif headline
- **UUID:** `08dd5e16-e5ea-474a-98d4-bede8a48563c`
- **What it is:** Solid black background, a large white *serif* headline ("Welcome back, Mira"), a 2x2 grid of dark-grey cards each with a quiet emoji-prefixed prompt, and a single rounded "Talk with Kin" composer at the bottom.
- **Why for Journada:** This is the cleanest example of *serif headlines on dark canvas in a non-news app*. The Cormorant-Garamond-on-deep-forest-green wordmark moment Journada wants to extend into the form is exactly this register — except Kin uses serif for *the page title* (not the wordmark in chrome). It legitimizes the move.

### 1.6 Matter — Reading display settings panel
- **UUID:** `44bb22f0-ec69-4361-b838-a96dd573c695`
- **What it is:** A dimmed-blur bottom panel that customizes a reading experience (theme, brightness, font, font-size, spacing, width). Each setting is a label-on-left + control-on-right row, separated by hairlines. No boxed cards. Theme picker is a row of four pill buttons inline.
- **Why for Journada:** The Gi/No-Gi, Session Type, Coach-led/Open-mat, Polarity toggles in the current form are conceptually identical to Matter's "Theme: Carbon / Black / Winter / Forest" segmented row. It's a proven pattern for "exclusive choice within a labeled property" in editorial-register dark mode.

### 1.7 Substack — Article display settings sheet
- **UUID:** `1ce125ff-49c0-47c2-b0ee-59f4d980e3fa` (also `d118563f-0d59-4cd2-a751-1808bfbb1c98` light variant)
- **What it is:** A bottom-anchored panel ("Display Settings — Article Viewer") with two horizontally-grouped pill rows: "ARTICLE FONT" (Bitter / Nunito / Söhne) and "TEXT SIZE" (Smaller / Default / Bigger). Selected pill outlined in blue, others muted gray.
- **Why for Journada:** Same as Matter — and confirms the "uppercase eyebrow + horizontal pill row" pattern is canonical in editorial apps. Shows the eyebrow is the *separator*, not the box border.

### 1.8 New York Times — Display Settings (dark)
- **UUID:** `a616e8cf-3598-4266-9a69-2d67908e20fa`
- **What it is:** Three sections — "APPEARANCE", "TEXT SIZE", "PREVIEW" — separated by hairlines and uppercase eyebrows. Within "APPEARANCE": three radio-row options each with a *secondary descriptor* line underneath. The "PREVIEW" section is a live serif sample.
- **Why for Journada:** This is the mature New Yorker / Times register the brief invokes by name. The two-line row (label + descriptor) is more sophisticated than a single label and would dignify properties like "Coach-led — guided by an instructor" / "Open mat — self-directed sparring."

### 1.9 Bear — New Note dark editor
- **UUID:** `c8a082ff-de05-4496-8ae7-6df459cef665`
- **What it is:** Pure black canvas, *serif* "New Note" centered title, a multiline serif text area with the keyboard already up, and a thin formatting toolbar (H1/H2/B/I/U/list) above the keyboard. The whole composition is "writing first, chrome second."
- **Why for Journada:** This is the closest analogue to what the Notes textarea at the bottom of Journada's form is *trying to be*. It also justifies pulling the wordmark serif into the form's heading.

### 1.10 222 — "preferences" serif text-input prompt
- **UUID:** `611ee5c2-33df-4161-ac12-4f259b164f6a`
- **What it is:** Muted dark forest-green canvas (close to Journada's `#0D1A14`), a tiny lowercase "preferences" eyebrow, then a *very large serif* prompt ("describe some traits of the people you'd like to meet"), then a smaller serif instructional sub-prompt, a thin hairline, and a multiline text input. Off-white type on dark green.
- **Why for Journada:** This is essentially the Journada brand brief made flesh. The dark-green-with-serif-on-cream-text register, the use of serif for the prompt question itself, the lowercase eyebrows — all of it transfers. Most validating reference in the set.

### 1.11 Gentler Streak — Slider with explanation
- **UUID:** `68875655-258e-4797-bad7-51dad7f6e8a8`
- **What it is:** A horizontal slider with an orange knob over a green track, accompanied by a status badge above and an instructional caption below ("Slide the orange dot to customize the activity effect").
- **Why for Journada:** Demonstrates that intensity-style controls *can* be sliders rather than 5-bar gradients without losing premium feel — and that an explanatory caption underneath can replace the eyebrow's role of orienting the user.

### 1.12 Headspace — Session-end summary
- **UUID:** `2b2bf7ee-9378-444b-b851-9c715bcbdc25`
- **What it is:** Two-color split canvas (deep purple top, near-black bottom), large numeric anchor ("71" minutes meditated), a quotation in the bottom half flanked by quotation marks, and a horizontal action row (heart / share / "Finish" CTA).
- **Why for Journada:** Reference for the *post-save confirmation* moment — Journada will want a similar contemplative beat after the user logs a session, before bouncing them back to the home page. Not directly load-bearing for the form itself, but the partner screen.

## 2. Pattern catalog

### 2.1 Container shells

| Pattern | Examples | Taste class | Notes |
|---|---|---|---|
| **Full-screen page** (no sheet, full-bleed) | Train Fitness `e436522c`, Bear `c8a082ff`, 222 `611ee5c2` | Editorial / premium | Reads as a *destination*, not an interruption. Best for a primary action like logging — reinforces that this *is* the moment, not a side-task. |
| **Bottom sheet, ~70-85% height** | Outsiders `3372f5ce`, Headspace pickers, Train Fitness confirm | Premium / utility | Frosted-glass top edge implies the home page is still there underneath. Good for a *quick* log; less good for a reflective one because it implies "get out of my way fast." |
| **Modal-card centered** | ABY Journal templates `63405991`, ten-ten `10e5279a` | Mixed | Feels lightweight, almost playful; rarely used by editorial apps. Likely wrong for Journada. |
| **Hybrid (sheet that pulls into full-page)** | Substack reader `1ce125ff` | Editorial | Increasingly rare on iOS, requires custom gesture work. |

**Recommendation for Journada:** Full-screen page. The form is the primary act, not a detour. The current "page with header, banner, three cards, CTA" is already operating as a full-screen page — the fix is what's *inside* that page, not its container.

### 2.2 Sectioning approaches

| Pattern | Examples | Taste class | Verdict for Journada |
|---|---|---|---|
| **Boxed cards with visible borders** | The current Journada form, GrowPal `c34fc97f` | Utility / dashboard | This is what the user is rejecting. Reads as a database admin form, not a journal. |
| **iOS grouped-list (rounded container, hairline dividers, no borders between groups)** | Train Fitness `e5e700ef` / `6e5896fd`, Bear settings `7e227aab`, NYT display `a616e8cf` | Editorial / premium | Dignified default. Eyebrow above each rounded group; hairlines inside. The closest "premium" form pattern in the iOS canon. |
| **Eyebrow + whitespace, no container at all** | 222 `611ee5c2`, Matter `44bb22f0` | Most editorial | Inputs sit directly on the page, separated only by a tracking-widest uppercase label and ~32-48px of vertical whitespace. Maximum "magazine spread" feel. |
| **Accordion / disclosure** | Train Fitness "Advanced Settings" row in `e436522c` | Utility | One bigger expandable row inside an otherwise flat list. Useful for the "Details (optional)" section — hides the optional weight while keeping it discoverable. |
| **Multi-step pager (Step 1 of 3)** | Several onboarding flows in research, NYT onboarding `86432944` | Utility / onboarding | Wrong genre. Splitting the log across screens implies the act is large; Journada wants it to feel small and habitual. |
| **Single editorial scroll, no sectioning at all** | Bear new-note `c8a082ff`, Day One-style entries | Most editorial | Treats the entire form as one continuous textual gesture. Only works when there are very few discrete inputs. Journada has too many to pull this off. |

**Recommendation for Journada:** Eyebrow + whitespace (no container). The grouped-list option is a fallback if eyebrow-only feels too austere in user testing. Both abolish the "three separate submodels" complaint by removing the visible perimeter of each section.

### 2.3 Hierarchy treatments — primary vs optional inputs

| Pattern | Examples | Notes |
|---|---|---|
| **All inputs at equal weight** | Most fitness apps in research | Wrong — implies the polarity toggle is as load-bearing as the duration. |
| **De-emphasized typography for optional** | Train Fitness `e436522c` ("ADD MORE INFORMATION" eyebrow has lower contrast than primary fields) | Cheap and effective — the eyebrow for the third section can be `champagne-gold/40%` or `copper/60%` instead of the standard treatment. |
| **Disclosure / accordion** | Train Fitness "Advanced Settings" row | Optional details collapse behind a single tappable row "Add details (optional)" with a chevron; expand inline. Removes them from initial cognitive load. |
| **Lighter surface tone** | Currently the form uses SURFACE_2 (one tone) for everything | Could shift the optional section onto the page background (`#0D1A14`) instead of `SURFACE_2` (`#152E22`), letting it visually recede. |
| **Separate page entirely** | NYT onboarding multi-step | Too heavyweight for "do you want to add tags." |

**Recommendation:** Inline disclosure for "Details (optional)." On first render, the user sees "+ Add notes & tags" as a single quiet row at the bottom, copper-tinted, no chevron-card. Tap reveals the textarea + tag picker. This pattern alone halves the visual weight of the screen.

### 2.4 Header treatment

| Pattern | Examples | Verdict |
|---|---|---|
| **Big editorial title (serif, left-aligned)** | Bear `c8a082ff`, 222 `611ee5c2`, Kin `08dd5e16` | Strongest brand-fit. Use Cormorant Garamond for "Log a Training Session" or even just "New Session" / "Today's Session" — making the form feel composed, not utilitarian. |
| **Compact app-bar with centered title** | Train Fitness `e5e700ef`, NYT settings | Disappears into chrome, abdicates the brand moment. |
| **Belt-banner hero** | The current Journada form | Fun, but on mobile it's chewing up vertical space the form badly needs. The belt-banner could collapse to a thin accent strip at the top of the page (1-2px line in copper, with the date floating above it in champagne-gold tracking-widest). |
| **Date as the headline** | Train Fitness summary `e5e700ef` ("Saturday, Aug 16, 2025" centered as title) | Compelling alternative — the date *is* the title, with the serif-styled "Journada" wordmark or no wordmark at all. Closer to a Day One entry, where the date IS the entry's identity. |

**Recommendation:** Replace H2 + animated belt banner with: `[Cormorant Garamond serif date as title]` + a 1px copper hairline below it. Keeps the belt color story (the hairline is a copper→champagne→copper subtle gradient), reclaims ~80px of vertical real estate, and matches NYT/Day One editorial register.

### 2.5 CTA placement

| Pattern | Examples | Notes |
|---|---|---|
| **Sticky bottom button (full-width, pinned over safe area)** | Train Fitness `e436522c`, Outsiders `3372f5ce` | Industry-standard for iOS forms. Always reachable, doesn't compete with content. |
| **Floating circular FAB** | Napper `47977f5c`, ABY Journal calendar | Wrong genre — feels like a social-app shortcut, not a deliberate save. |
| **Inline at the end of the form** | Some onboarding flows | Forces user to scroll to commit; bad for "I just want to save and go to bed." |
| **Sticky toolbar with multiple actions** | Train Fitness review `e5e700ef` ("Done" + thumbs up/down) | If Journada wants a one-tap "How did the session feel?" gesture *before* save, this works — a single 52px brand-orange button paired with a small "Save and reflect" affordance. |

**Recommendation:** Keep the current sticky 52px brand-orange `Save Session` CTA. It's already correct.

### 2.6 Date / time chooser

| Pattern | Examples | Notes |
|---|---|---|
| **Wheel picker in bottom sheet** | Wise `f346a93a` | Heavy iOS classic. Premium but slow. |
| **Calendar popover** | Napper `47977f5c` (full month view) | Most spatial but eats screen. |
| **Segmented day strip (last 7 days)** | TIDE `5668f6ad`, Unwind `29429943` | Excellent — shows the last week with dots indicating "you logged then." Tap to switch the date the entry is for. |
| **Today / Yesterday quick chips + "more dates"** | Common in todo apps (Planny `d6daf061` family) | Fastest. Works well because 95% of sessions logged are "today" or "yesterday." |

**Recommendation:** A horizontal day strip (today + previous 6 days) with dots underneath days that already have a session — leaning on TIDE's `5668f6ad` pattern. Tap any day to set that as the entry date. "..." at the right end opens a calendar for older dates. Replaces the static animated belt-banner with a *useful* affordance that still carries belt-color iconography (the dots can be belt-colored).

### 2.7 Multi-state inputs

| Pattern | Examples | Pros | Cons |
|---|---|---|---|
| **Segmented control (iOS native)** | Matter `44bb22f0`, Substack `1ce125ff` | Immediately legible, system-feels-system | Can feel utilitarian if overused |
| **Pill row (4 inline buttons)** | Matter theme picker | More custom-feeling than segmented | Same shape as a segmented control basically |
| **Toggle switch** | Settings everywhere | Binary only | The Gi/No-Gi could legitimately be one |
| **5-bar intensity gradient** (current Journada) | Custom — uncommon in research | Visceral, communicates "this is a feeling not a number" | Heavy; could be replaced with a slider + word labels |
| **Slider with knob** | Gentler Streak `68875655` | Continuous, soft | Less precise for 1-5 |
| **Radio rows with descriptors** | NYT `a616e8cf` (Auto / Dark / Light each with explanation) | Most editorial, most informative | Takes vertical space |
| **Gestural pad (the Prism)** | Journada-specific, no precedent in research | Unique brand moment | Justifies its space iff it's the *centerpiece*, which it is |

**Recommendation for Journada specifically:** Keep the Prism as the visual anchor of the form (it's the brand). Demote the binary toggles (Gi/No-Gi, Coach-led/Open-mat, Polarity) to NYT-style radio rows or compact segmented controls — they should not be the same visual weight as the Prism. The 5-bar intensity could become a labeled slider ("Light → Hard") or stay as bars if they're miniaturized to feel like a sub-control rather than a primary input.

## 3. Anti-patterns observed

Patterns that recur in adjacent apps but are *wrong* for Journada:

- **Bright accent gradients on cards** (Train Fitness `e436522c` purple highlight card, Headspace `3d29a513` orange/blue gradient cards). Reads gym-bro / consumer-tracker. The user's brief explicitly forbids gradients.
- **Big numeric "wins" prominently displayed** ("75,442 lb", "350 kcal" — Train Fitness `0d6b250a` and `cd5835f0`). Performance-trophy register. Journada is anti-PR-chase.
- **Social affordances inline in the log** (heart, comment, share buttons in the bottom bar — Train Fitness `0d6b250a`). Wrong category.
- **Floating action button in pink/orange/saturated color** (Napper `47977f5c`). Reads gamified.
- **Confetti / saved-success animations with playful copy** (Alive `80e90b55` — "Let's get this day, girl!"). Explicitly allergic register.
- **Three-dot ellipsis menus on every row** (Dropset family — `aeb37f59`, `c0d8bb49`). Suggests a CRUD admin tool, not a notebook. Each row should be quietly tappable, not festooned with secondary affordances.
- **Heatmap calendars on the log page itself** (TIDE `23a7f747`). Belongs on the history/dashboard, not at the moment of writing.
- **Big page-padding cards stacked vertically with fat borders** — i.e. the current Journada mobile form. This pattern only works in light-mode dashboards; in dark-mode editorial it reads as a Trello board.

## 4. Three concrete directions for Journada

Ranked by recommendation strength.

### Direction A — "The Editorial Page" (recommended)

**One-line:** Single-scroll full-screen page with eyebrow-only sectioning, Cormorant-Garamond serif date as the headline, a thin copper hairline beneath, and a sticky orange CTA — i.e. NYT settings × Bear new-note × 222 preferences.

**Draws from:** 222 `611ee5c2`, NYT `a616e8cf`, Bear `c8a082ff`, Train Fitness `e5e700ef` (grouped-list rhythm), 222 dark-green canvas, Matter `44bb22f0` for inline pill rows.

**How it solves the "three submodels" complaint:** It deletes the SURFACE_2 boxes entirely. Sections are separated by uppercase tracking-widest copper eyebrows ("BASICS" / "FOCUS" / "DETAILS") and ~40px of vertical whitespace. Inputs sit directly on the page background. Visually it is *one* surface, with rhythm.

**Structurally requires:**
- Replace boxed cards with eyebrow-labeled sections, no internal borders.
- Replace H2 + belt banner with serif date as the title and a 1px copper-gradient hairline.
- Convert Polarity / Coach-led / Gi-No-Gi from full-width toggle blocks to NYT-style radio rows OR inline pill segments.
- Demote intensity from a 5-bar gradient to either a slider (Gentler Streak style) or a 5-pill horizontal row (Matter style).
- Wrap "Details (optional)" in an inline disclosure — single quiet "+ Add notes & tags" row at the bottom; tap to expand.
- Day strip replaces the animated belt banner.
- Prism stays unchanged — it's the centerpiece, and a single editorial canvas actually *gives it more presence* than when it was sharing a SURFACE_2 box with two toggles.

**Tradeoffs:**
- Loses the belt-banner animation moment. Could be preserved as a tiny date-strip accent or as the entry-confirmation screen.
- Eyebrow-only sectioning requires disciplined typography — looks bare if eyebrows are too low-contrast or too short. Mitigation: use copper at 80% opacity, tracking-widest, tracking 0.16em, 11px.
- Slightly more design work to land than option B.

### Direction B — "The Grouped Notebook"

**One-line:** Same as A, but each section sits inside a single rounded SURFACE_2 container with hairline dividers between rows — i.e. iOS Settings page rendered in Journada's palette.

**Draws from:** Train Fitness `e5e700ef` and `6e5896fd`, NYT settings `a616e8cf`, Bear settings `7e227aab` and `d5d602be`.

**How it solves the complaint:** Three boxes become one box per section, but the box has *internal hairlines instead of internal padding-around-each-row*. The total visual weight drops by ~60% because the border budget halves and the rows pack tighter.

**Structurally requires:**
- One SURFACE_2 rounded container per section (still three, but quieter).
- Hairline dividers (1px, `champagne-gold/8%`) between rows inside each container.
- Same eyebrow treatment as Direction A above each container.
- Same disclosure pattern for the optional section.

**Tradeoffs:**
- Still *technically* three containers, so risks the same complaint at lower volume.
- More familiar to iOS users; lower learning curve.
- Lower design risk, lower payoff.

### Direction C — "The Dawn Sheet"

**One-line:** Convert the form from a full-screen page to a frosted bottom sheet that pulls up from the home page — i.e. Outsiders `3372f5ce` × Substack reader settings.

**Draws from:** Outsiders `3372f5ce`, Headspace pickers, Substack `1ce125ff`.

**How it solves the complaint:** The sheet has only one container (itself), so the question of "how many sub-cards?" becomes moot — sections inside are eyebrow-separated as in A.

**Structurally requires:**
- Sheet presentation from the home page (the home page stays visible at top, dimmed).
- Drag-handle at top, large serif title centered.
- Same internal pattern as Direction A.
- The Prism inside a sheet may feel cramped on small phones (375px); needs careful sizing.

**Tradeoffs:**
- Implies the log is a "quick sub-task" rather than the day's primary moment. Conceptually backward for a journal.
- Sheets cap your vertical space; the Prism + 7 inputs + notes + CTA may not all fit comfortably on iPhone SE without scroll-inside-sheet (which feels janky).
- *Could* work if the entry is *truly* short (e.g., a "did you train today?" log with just date/duration/intensity), but Journada's form has too many fields.

**Verdict on C:** Don't pursue unless the form is being actively shrunk.

## 5. Brand-fit checklist

Scoring 1 (worst) to 5 (best) for each direction.

| Criterion | A: Editorial Page | B: Grouped Notebook | C: Dawn Sheet |
|---|---|---|---|
| Editorial register match | 5 | 4 | 3 |
| Touch ergonomics on 375px | 4 | 5 | 3 |
| "Lab notebook + memory book" feel | 5 | 4 | 3 |
| Avoids gym-bro / dashboard register | 5 | 4 | 4 |
| Implementation complexity (lower = easier) | 3 | 4 | 2 |
| **Total (out of 25)** | **22** | **21** | **15** |

A and B are both viable; C is a fallback. A is recommended.

## 6. Open questions to resolve before implementation

1. **Date strip vs animated belt banner.** Is the belt-banner emotionally load-bearing for the user, or is it ornament that can be relocated? If load-bearing, Direction A needs to preserve it as a thinner accent (the copper hairline could subtly animate with belt-rank gradient stops). If not, just delete it on mobile.

2. **Intensity input shape.** Slider (Gentler Streak), 5-pill segmented row (Matter), or keep current 5-bar gradient at smaller scale? Each has implications for how the bar appears in history/exports — pick one and propagate.

3. **Toggle reduction.** Of the four binary controls (Gi/No-Gi, Session Type, Coach-led/Open-mat, Polarity), can any be defaulted-and-hidden behind disclosure? E.g. Gi/No-Gi could remember last value and only surface as a row if user wants to change it. Reduces section 1 from "five inputs" to "three inputs + two memory-defaulted inferred." Massive ergonomic win.

4. **Serif use.** Brief says Cormorant Garamond is reserved for the wordmark. Would the user extend it to the *date headline of each session-log* (e.g. "Sunday, April 26") since that IS the entry's identity, like Day One? Or keep it strictly wordmark-only and use Plus Jakarta Sans tracking-tight for the headline?

5. **Optional details — collapsed-by-default vs always-shown.** If the user reliably uses tags/notes (which the Two-Tier Tag System project suggests they intend to), collapsing them might harm adoption. If most sessions are quick logs with no notes, collapsing cleans the form by ~40% on first paint. Need usage data or a deliberate UX bet.

## References — quick lookup

| App | UUID | Why it matters |
|---|---|---|
| Train Fitness Generate | `e436522c-e413-46d5-9518-6e6b64bdef65` | Reference for full-screen single-column form, eyebrow + whitespace |
| Train Fitness Summary | `e5e700ef-c6b6-441f-b6a6-632f836acb9b` | Three eyebrow groups inside one canvas |
| Train Fitness Summary alt | `6e5896fd-c023-4a7d-a449-06ec5480b838` | Same as above, alternate layout |
| The Outsiders Type Picker | `3372f5ce-118e-4385-9ebf-beee4ae3c516` | Frosted bottom sheet with eyebrow groups |
| ABY Journal Templates | `63405991-5973-4b85-99c1-5ee6afb73f01` | Handwritten preview lines inside dark cards |
| Kin Home | `08dd5e16-e5ea-474a-98d4-bede8a48563c` | Serif headline on dark canvas in non-news app |
| Matter Reading Settings | `44bb22f0-ec69-4361-b838-a96dd573c695` | Inline pill row for exclusive choices, hairline-only sectioning |
| Substack Display | `1ce125ff-49c0-47c2-b0ee-59f4d980e3fa` | Eyebrow + horizontal pill group canon |
| NYT Display Settings | `a616e8cf-3598-4266-9a69-2d67908e20fa` | Three eyebrow sections + radio rows with descriptors |
| Bear New Note Dark | `c8a082ff-de05-4496-8ae7-6df459cef665` | Serif title + writing-first dark editor |
| 222 preferences | `611ee5c2-33df-4161-ac12-4f259b164f6a` | Closest visual analogue to Journada brand brief |
| Gentler Streak slider | `68875655-258e-4797-bad7-51dad7f6e8a8` | Slider with caption alternative to bar gradient |
| Headspace session end | `2b2bf7ee-9378-444b-b851-9c715bcbdc25` | Post-save reflective beat |
| TIDE day strip | `5668f6ad-1f30-4d4a-87ae-7f925d409fd2` | Day strip with logged-day dot indicators |
| Unwind history | `29429943-2797-43cd-b6a1-f139eb57dae0` / `faf96a62-4c6f-48c8-b8f3-25ccf9c50060` | Day strip variant in dark purple |
| Train Fitness workout log | `0d6b250a-e169-4faa-863a-81023ada710f` | Anti-pattern: gym-bro big-numbers register |
| Alive saved | `80e90b55-55ac-494f-84fc-4bad7e801c01` | Anti-pattern: confetti success copy |
| Dropset rows | `aeb37f59-2bbc-469f-8216-7e73cd1365e7` | Anti-pattern: ellipsis-menu CRUD register |
| Napper FAB | `47977f5c-434b-4f4d-be6a-0a76177f33c9` | Anti-pattern: pink FAB on dark canvas |
| GrowPal dashboard | `c34fc97f-e90b-41eb-8676-ae0f4f1a563b` | Anti-pattern: boxed card stack on dark mode |
