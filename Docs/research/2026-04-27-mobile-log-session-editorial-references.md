# Mobile Log-Session — Editorial-Register Reference Research

**Date:** 2026-04-27
**Author:** Research pass for Journada mobile log-session redesign
**Scope:** Field-mapping how premium, editorial-register iOS apps treat single-screen authoring forms — to inform the move away from three boxed cards on Journada's mobile log-session screen.

---

## Why this exists

Journada's current mobile log-session screen stacks three rectangular cards — *The Basics*, *What did you work on?*, *Details (optional)* — and the desktop version reads as more sophisticated than the phone version. The cards work like a settings screen rather than a journal entry. The brand brief explicitly puts Journada in the company of Day One, Bear, Things 3, Reeder, the New Yorker, Aesop, Claude.ai, and Oak — *not* Strava, Hevy, MyFitnessPal, or Duolingo. The redesign needs to move the form from "configurator" toward "page in a notebook."

This document catalogues how the canonical editorial-register apps actually structure their compose flows, surfaces patterns that recur across them, names the fitness-tracker patterns to refuse, and ends with a concrete recommendation for the Journada redesign.

---

## Section 1 — Reference catalog

### 1. Day One (iOS)

The closest direct analog. Day One's entry editor is famous for *getting out of the way*. When you tap the floating compose button, you are dropped straight into a writing surface — there is no card, no boxed "Title" field, no labelled section called "What did you do?" The cursor lands in the body and the keyboard rises. The first line behaves as the title (its weight is bolder by default, controlled in Settings → New Notes Starts With → Title — Apple Notes uses this same convention). Above the keyboard sits a single thin formatting bar with two icons: an `Aa` for headers/markdown formatting, and a paperclip `📎` for attachments and metadata (photo, audio, camera, tags, template). All of the "secondary" inputs — tags, location, weather, date, mood — are available, but they are tucked behind that paperclip glyph and a metadata strip rather than presented as a vertical scroll of labelled rows. The save action is implicit: tap `Done` (top-trailing) or swipe the keyboard down. There is no sticky CTA at the bottom. Dark mode uses a near-black with subtle warmth, not pure `#000`. Typography is the system serif option (Whitney, Ideal Sans, Sentinel are the premium add-ons). [Source: Day One iOS editor guide](https://dayoneapp.com/guides/tips-and-tutorials/editing-and-formatting-entries-in-day-one-for-ios/) — quote: *"tap anywhere in the body to place the cursor and begin editing… the Aa icon at the top right of the keyboard accesses Headers, Bold, Italics… a paper clip icon adds photos, audio, tags."*

### 2. Bear (iOS)

Bear's compose screen is the most aggressive de-chroming on this list. There is **one** input: the body. The first line is the title, styled larger and bolder by markdown convention. Tags are typed *inline* with `#` — they are not a separate field. Body text uses the user's chosen typeface (Bear ships with several premium families and a typography panel in settings). Padding is generous; the line height is loose; the cursor sits in roomy whitespace. There is no save button at all — the document is always saved. Dark themes ("Dieci," "Shibuya Jazz," "Shibuya Lo-fi") are deeply considered, with deep-black `#000000` reserved for OLED themes and warmer near-blacks for non-OLED. The chrome philosophy is captured in their own messaging: *"a comfortable, beautiful place to write."* The lesson: when the form is *the document*, you can eliminate field labels entirely and let typography carry the hierarchy. [Source: Bear typography page](https://bear.app/faq/typography-options/) and [Bear themes blog](https://blog.bear.app/tag/themes/).

### 3. Things 3 (Cultured Code)

Things is the master class in *splitting essential entry from enrichment*. The compose flow has two stages and they are visually distinct:

- **Stage 1 — quick entry.** Tap the Magic Plus button. A small floating row appears asking only for a task title. No tags, no project, no deadline. Just the title.
- **Stage 2 — enrichment.** Tap the row after it lands in the list. The to-do "pops out" with a fluid spring animation while the surrounding rows fade. You then see notes, checklist, when, deadline, tags — but each is its own affordance, *not* a labelled form field. Dates and tags open as "large, dark pop-ups" overlaid on the dimmed list, so a single dimension is set at a time.

The animation system is famously precise (the plus button has fluid-deformation when dragged), and the white-space-to-content ratio on every screen is unusually high. Typography is San Francisco at varied weights; bold is used for hierarchy, never color. There is no sticky bottom CTA — committing is "tap away" or "swipe down." [Source: MacStories review of Things 3](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/) — quote: *"Task metadata like due dates and tags are applied in large, dark pop-ups that make it easy to quickly adjust something and move on. I wish more apps looked like this."*

### 4. Reeder (iOS)

Reeder doesn't have a compose flow per se, but it is the canonical reference for *editorial chrome on a utility app*. Its filter sheets and action menus are minimal: a sheet with sectioned rows separated by hairline dividers, no card backgrounds, no rounded "group containers" — just rows on the panel surface. Themes include *light, sepia, dark, and black*, with `black` reserved for OLED. The "settings menu sets a new standard" with a "pared-down approach to customization." The lesson for our form: *iOS group-table cards are the wrong default*. Reeder uses sectioned lists with section headers as small uppercase eyebrow labels, divided by 1px hairlines on the canvas surface — no rounded inset boxes. [Source: Reeder 4 review on The Sweet Setup](https://thesweetsetup.com/reeder-4/).

### 5. The New Yorker (iOS)

A reading app, not a compose app, but it sets the typographic ceiling for what "editorial register on mobile" means. The masthead uses NY Irvin (the magazine's signature display face); body uses Adobe Caslon Pro. Article pages are framed by generous side whitespace ("crisp columns of whitespace appear on either side of the text body, creating a magazine-on-the-screen experience"). What's worth borrowing for our log-session screen: the *eyebrow / category label* convention (small caps, letter-spaced, low-contrast) used to label sections like "Talk of the Town." This is exactly the typographic move that replaces a card border. [Source: DesignRush analysis of The New Yorker](https://www.designrush.com/best-designs/websites/new-yorker).

### 6. Apple Notes (iOS)

The system baseline. Important precisely because it shows what Apple itself thinks is the right default for a compose flow. Apple Notes: *no title field*. The first line of the note is bolded automatically (controlled by Settings → Notes → New Notes Starts With → Title). The compose surface is the paper. The format bar is a thin row above the keyboard. Done is top-right. No sectioning, no cards, no labels. The reason every premium notes app converges on this pattern is that Apple validated it. [Source: Apple Support — Create and format notes on iPhone](https://support.apple.com/guide/iphone/create-and-format-notes-iph1ac0b3a2/ios).

### 7. Reach (calendar) — note

I was unable to find rigorous design coverage of "Reach" as a calendar app — public reviews are thin and the product appears to be lower-profile than expected (more travel/ETA tooling than calendar). I'd recommend Fantastical as the substitute reference here: its event-creation sheet is the calendar-app analog of Things 3's enrichment popover (see [Zapier's best-iPhone-calendar-apps roundup](https://zapier.com/blog/best-iphone-calendar-apps/)).

### Tier 2 quick notes

- **Substack mobile** — recently shipped a mobile editor. The compose screen is essentially the Bear pattern (body = document) plus a `Next` button that gates a separate publish-settings screen. The lesson is *gate metadata behind a second screen rather than scrolling alongside the body*. [Source: Substack mobile editor announcement](https://on.substack.com/p/mobile-editor).
- **Are.na** — the "add to channel" flow is sectioned by hairline rule, not by card. Block content is full-bleed with no shadow. App Store update notes mention *"a new, unified add flow with improved metadata editing"* — confirming they consolidated rather than expanded their compose surface.
- **Working Copy** — strong commit-message form: monospaced body, hairline metadata strip showing branch and file count, no card chrome, no labelled "Subject / Body" fields. Uses keyboard accessory bar for actions. [Source: Working Copy users' guide](https://workingcopyapp.com/users-guide).
- **Patreon** — the 2023 Wolff Olins rebrand introduced a variable typeface that "morphs from a more medium-density form to a thinner, lighter-density manifestation" — the *brand* is variable but the compose flow itself is conventional. Worth referencing for typography variability, not for form layout. [Source: Patreon redesign brand article](https://news.patreon.com/articles/patreon-redesigned).

### Tier 3 — taste references

- **Aesop website** — labels in Optima (the wordmark) over Helvetica Neue body, set on cream `#F5F0E6`, with *no buttons that look like buttons* — every CTA is a link with an arrow. The whole site reads as apothecary signage. The lesson: editorial register treats the call-to-action as a typographic gesture, not a button shape. [Source: Fonts In Use — Aesop](https://fontsinuse.com/uses/20234/aesop-logo-website-and-packaging).
- **Claude.ai** — single composer at the bottom of a near-empty canvas. The form *is* the page. No labels, no cards, just a textarea with whisper-quiet attachment chips when needed.
- **Oak (meditation)** — the compose-equivalent (session selection / breath setup) uses a single dimension per screen with very large type set against deep, near-black backgrounds. Sliding screens, never stacked cards. [Source: Tools and Toys review of Oak](https://toolsandtoys.net/oak-meditation-app-for-ios/).

---

## Section 2 — Patterns that recur across the editorial register

Five patterns showed up over and over in Tier-1 apps:

**Pattern 1 — The headline of the form is the first input itself.** Day One, Bear, Apple Notes, Substack mobile, Things 3 quick-add, and Are.na's add flow all eliminate the labelled "Title" field. The title is a typographically heavier first line of the body. There is no `<label>Title</label>` row above an `<input>`. This is the single most consistent pattern in the editorial register and the most consistent point of departure from the fitness-tracker register.

**Pattern 2 — No card chrome; section breaks are typography + hairline.** Reeder's settings sheets, Are.na's add flow, Bear's editor, and Day One's body all dispense with iOS's grouped-table inset card. Where sections are needed, they are separated by a 1px hairline at ~10–15% surface luminance and an *eyebrow* label (small caps, letter-spaced 0.08–0.12em, low-contrast color, ~11–12pt). No rounded rectangle backgrounds.

**Pattern 3 — Optional fields hide behind a glyph or a `Next` step.** Day One puts everything except the body behind the paperclip. Things 3 splits quick-add from enrichment into two interaction steps. Substack mobile gates publish settings behind `Next`. Bear hides tags inline behind the `#` keystroke. The pattern: the form *as initially seen* shows essentials only; everything else is one tap away, never visible-but-empty.

**Pattern 4 — No sticky bottom CTA; commit is implicit (`Done` top-right, swipe-down keyboard, or auto-save).** None of Day One, Bear, Apple Notes, Things 3, or Reeder uses a sticky `Save` bar at the bottom of the compose screen. Save is a top-right `Done`, a swipe-down gesture, or it happens automatically as you type. This is a deliberate choice: a sticky CTA at the bottom of a journal entry communicates *transaction*, not *reflection*.

**Pattern 5 — Hierarchy is carried by weight and opacity, not color or saturation.** Things 3 uses a single ink color and varies weight. Bear's themes vary background and accent but body always reads as ink-on-paper. Apple Notes is flat type with bold first line. None of these apps use blue-pill chips, green checkmark validation, or red error states inside the compose flow. (This aligns directly with Journada's *"hierarchy from opacity not saturation"* brief.)

---

## Section 3 — Patterns that feel wrong for this register

These are the patterns the avoid-list apps (Strava, Nike Training Club, Hevy, MyFitnessPal, Duolingo) use that we should explicitly *not* import:

**Anti-pattern A — Labelled box per field.** Hevy and Strong present each field (sets, reps, RPE, notes) as a row in a heavy rounded card with a colored leading icon. This is the "configurator" register. A user filling this out feels like a data-entry clerk, not a writer. Journada's current three-card layout sits dangerously close to this register.

**Anti-pattern B — Sticky gradient CTA at the bottom.** Strava and MyFitnessPal both pin a bright "Save Activity" / "Log" button to the bottom of the compose screen, often with a green or orange gradient. This communicates *commit a transaction*. None of our reference apps do this. (Note: the tempting argument that "the button needs to be reachable for one-handed use" is solved in the editorial register by putting `Save` in the top-right where it's been for 15 years — users know where to find it.)

**Anti-pattern C — Required-field asterisks and inline validation pills.** Editorial-register apps assume the user is competent and trusted. They do not annotate `Title *` or surface red `Required` chips. Validation, where needed at all, is delayed until commit and shown as a quiet sentence, not a colored badge.

**Anti-pattern D — Progress meters / completion percentage in the form chrome.** Duolingo and Strong ornament the compose screen with "70% complete" bars or XP gain previews. Even subtle versions of this — "fill 3/3 sections to log" — are anti-editorial.

**Anti-pattern E — Section headers as filled colored bars.** Many fitness apps use `bg-emerald-600` filled headers ("WORKOUT DETAILS"). The editorial register uses a **letter-spaced eyebrow** instead — same information, far less shouting.

---

## Section 4 — Application to Journada's mobile log-session form

### The single highest-leverage taste change

**Eliminate the three rounded card containers.** The cards are the entire reason the screen reads as "configurator" rather than "page from a journal." Replace them with one continuous canvas, divided where genuinely needed by hairline rules and small letter-spaced eyebrow labels. This is the move every Tier-1 app has converged on, and it is the one change that will most efficiently shift the register.

### How sectioning should evolve

Move from three boxed cards to a **single vertical canvas with three soft moments of typography**. Concretely:

1. **The first thing on the screen is a date/wordmark moment** (Cormorant Garamond, ~22–26pt, copper or champagne, low-contrast). One line: e.g., *"Sunday, the 27th"* or *"Two weeks. The mat is starting to know you."* This is the "magazine masthead" moment. It is *not* an input — it sets the page.
2. **Below that, the title-as-first-input.** No `<label>` above. A single line with placeholder *"What stayed with you?"* (Plus Jakarta Sans, ~20pt, weight 500). When you type, the placeholder vanishes; what you typed becomes the entry's title.
3. **Below that, a soft eyebrow `WHAT YOU WORKED ON`** (Plus Jakarta Sans, 11pt, tracking 0.1em, opacity ~50%) sitting on the same canvas — *not* in a card. Underneath, the pillar/tag chips render as quiet hairline-bordered ovals (no fill), copper border at ~30% opacity. Tapping a chip fills it copper-on-forest.
4. **A single hairline rule** at ~10% opacity. Below it, an eyebrow `DETAILS` and a quiet two-line body field with placeholder *"Anything else worth remembering?"* This is the *Bear pattern*: optional, but always visible, never gated behind a disclosure click — because the point of a journal is that the writing is the heart of the entry, not a buried "notes" field.
5. **No card chrome anywhere.** No `bg-card/40 border rounded-2xl`. The page is the page.

Save lives **top-right** as a serif `Done` (Cormorant Garamond, copper). No sticky bottom CTA. Cancel is top-left as a low-opacity `×`.

### How typographic hierarchy should evolve

| Role | Type | Size | Weight | Color | Opacity |
|---|---|---|---|---|---|
| Date wordmark | Cormorant Garamond | 22–26 | 400 | champagne `#F2E4A8` | 70% |
| Optional masthead line ("Two weeks. The mat is starting to know you.") | Cormorant Garamond italic | 14 | 400 | champagne | 55% |
| Title input | Plus Jakarta Sans | 20 | 500 | ink (paper-on-forest) | 100% |
| Eyebrow labels (`WHAT YOU WORKED ON`, `DETAILS`) | Plus Jakarta Sans | 11 | 500 | copper `#C4915F` | 50%, tracking 0.1em |
| Body input | Plus Jakarta Sans | 16 | 400 | ink | 90% |
| Placeholder | Plus Jakarta Sans | (matches above) | 400 | ink | 35% |
| Pillar chips | Plus Jakarta Sans | 13 | 500 | copper border, ink fill on tap | 30% border |

Every scale step is set so the user can scan the form by typographic weight alone — no card edges needed.

### What "first impression" the form should give in the first 1.5 seconds

When the user opens the screen, the eye should land on **a date set in serif** at the top of a forest-dark canvas, with a single italic line beneath it that feels addressed-to-them, then a quiet cursor in roomy whitespace. **No buttons should be visible below the fold initially.** No category icons. No required-field markers. The screen should read: *"this is a page in a notebook that has been waiting for you,"* not *"complete this form to continue."*

### Three "moodboard" descriptions of the redesign

1. **"The Day One page."** Open the screen, see a date in serif, see a cursor blinking against forest, type. Tags hide behind a paperclip-equivalent in the keyboard accessory. Done is top-right. No card edges, no sticky bottom bar. *Reference: Day One iOS editor + Apple Notes' first-line-as-title.*
2. **"The Reeder sheet."** A canvas surface with sectioned rows divided by hairline rules and small letter-spaced eyebrow labels. The pillar chips render as low-fill outline ovals — no rounded card containers around them. *Reference: Reeder 4 settings sheet + Are.na unified add flow.*
3. **"The Aesop label."** Cormorant Garamond date, Plus Jakarta Sans body, copper-on-forest restraint, every CTA is a typographic gesture (a serif `Done`, a hairline-bordered chip) rather than a filled button. The form reads as printed signage rather than as software chrome. *Reference: Aesop website + Patreon variable typeface treatment.*

---

## Section 5 — Watch-outs / things that surprised me

**1. The "no card" approach requires real type-system discipline.** When Day One, Bear, and Apple Notes drop card chrome, they survive only because their typographic scale is rigorous — eyebrow ≠ body ≠ title ≠ caption is unmistakable from weight and tracking alone. If Journada eliminates cards but the type scale is muddy (e.g., body and eyebrow at the same weight), the screen will read as undifferentiated mush. **The card removal must ship together with a tightened scale.** This is the single biggest implementation risk.

**2. Bear and Apple Notes' "first line is title" trick is more subtle than it sounds.** It only works because both apps *delay* the visual change — you type plain text, and only after you commit a newline does the first line bold up and the body text de-emphasize. Implementing this on a structured form (where title and body are separate database columns) requires the title field to *visually feel* like the same surface as body, not a bordered input. Using a transparent background, no border, no underline, and matching paper-color is the trick.

**3. Things 3's split between quick-add and enrichment is a defensible design move, but it requires a list view for the entry to land in.** Journada has that (the entry list / calendar view). Consider whether a stripped quick-add ("just title + a single primary tag") with enrichment-on-tap is a better pattern than one comprehensive form. Especially given the audience is parents-with-kids who log at 9pm with their thumb. Worth a separate prototype.

**4. Substack mobile's `Next` step is a mature compromise.** If keeping all metadata on one screen feels too crowded after the redesign, gating "advanced" fields (mood, intensity, notes-on-partners, video link) behind a `Next` to a second screen is well-precedented and not anti-editorial. It's only anti-editorial if `Next` leads to a *labelled-row form* — which we wouldn't build.

**5. Dark mode is not "near-black" — it's "warm near-black at the right luminance."** Bear's "Dieci" theme, Day One's dark mode, and the New Yorker app all use near-blacks in the `#0E–#16` luminance range with warm hue (forest, charcoal-warm, ink-blue). Journada's `#0D1A14` / `#152E22` is correctly placed in that range. The watch-out: if the form chrome reverts to flat `#0F0F0F` slate, the brand warmth is lost in five pixels of CSS. Every surface in the redesign should sample from the existing forest palette, never from a generic dark-mode utility class.

---

## Sources

- Day One iOS editor guide — https://dayoneapp.com/guides/tips-and-tutorials/editing-and-formatting-entries-in-day-one-for-ios/
- Day One Version 3 release notes — https://dayoneapp.com/blog/version-3/
- Day One Sweet Setup review — https://thesweetsetup.com/day-one-for-ios-hits-version-3-introduces-audio-snippets-dark-mode-and-tons-more/
- Bear typography options — https://bear.app/faq/typography-options/
- Bear themes blog — https://blog.bear.app/tag/themes/
- Bear 2.3.11 update — https://blog.bear.app/2025/02/bear-2-3-11-update-read-only-mode-new-themes-and-more/
- Bear 2.0 editor preview — https://blog.bear.app/2021/03/the-editor-preview-for-bear-2-0-on-ios-is-here/
- Things 3 — Cultured Code — https://culturedcode.com/things/features/
- Things 3 review — Sweet Setup — https://thesweetsetup.com/cultured-code-releases-things-3/
- Things 3 review — MacStories — https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- Reeder 4 review — https://thesweetsetup.com/reeder-4/
- The New Yorker design analysis — https://www.designrush.com/best-designs/websites/new-yorker
- The New Yorker style guide — https://bradfrost.github.io/cn-style-guide/styles/the-new-yorker.html
- Apple Notes — Create and format notes on iPhone — https://support.apple.com/guide/iphone/create-and-format-notes-iph1ac0b3a2/ios
- Substack mobile editor — https://on.substack.com/p/mobile-editor
- Substack design critique — https://brettisalive.substack.com/p/design-analysis-a-critique-of-substack
- Working Copy users' guide — https://workingcopyapp.com/users-guide
- Patreon redesign — https://news.patreon.com/articles/patreon-redesigned
- Patreon — Wolff Olins case — https://wolffolins.com/work/patreon
- Aesop fonts in use — https://fontsinuse.com/uses/20234/aesop-logo-website-and-packaging
- Oak meditation review — Tools and Toys — https://toolsandtoys.net/oak-meditation-app-for-ios/
- Day One review — Shawn Blanc — https://shawnblanc.net/2012/08/day-one-review/
- Apple HIG — Disclosure controls — https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- Zapier — best iPhone calendar apps — https://zapier.com/blog/best-iphone-calendar-apps/
