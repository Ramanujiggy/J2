# Constraints Library, Rep Roulette Toggle, and CLA Conditional Fields — Refero Research Pass

Research date: 2026-04-27
Author: Refero pass for Journada (BJJ training journal)
Scope: Three coupled UI questions feeding the upcoming CLA (Constraints-Led Approach) feature — a Constraints Library (`canonical_constraints` + `user_constraints`), a `ConstraintPicker` mirroring the existing `TagPicker`, a Rep Roulette pool toggle (drills vs constraints), and conditional form-field reveal when `session_type` flips to `CLA`.

This is design research, not implementation. The objective is to ground the new picker and roulette toggle in patterns from premium iOS/web apps that share Journada's editorial register (Day One, Bear, Linear, Raycast, Apple ecosystem) and to explicitly contrast against gym-bro/utility apps Journada must not feel like (Strava, Hevy, Duolingo).

The existing `TagPicker.tsx` was read in full before drafting the recommendations, so the proposals are calibrated to extend the in-house pattern rather than introduce a foreign one.

---

## Section 1 — Library + Picker References (common + custom cohabitation)

These are the screens whose typeahead, common/custom distinction, and chip rendering best inform the `ConstraintPicker`. iOS-first because Journada's priority surface is mobile, with two web references included for completeness.

### 1.1 Bear — Edit Tag picker with icon grid and inline create
**Refero UUID:** `fa61a6a3-7e46-43fa-a349-696a14c0bcee` (also `beb55a9f-cdf6-44ff-b34f-29d4129c12b9`, dark-mode sibling)
**App:** Bear (ID 43) · iOS

A modal centered over the sidebar presents a single editable text field (with the tag icon prefixed and a clear "x" suffix), a search bar, and a 6×6 grid of icons for visual disambiguation. The visual model — *one inline text input* + *immediate dropdown of suggestions below* + *Cancel / Done at the foot* — is the canonical iOS editorial-app picker. Bear also demonstrates that an editing/tagging flow can stay inside a small focused modal without ever leaving the writing context, which matches Journada's reflective-journaling register.

What this gives Journada: confirmation that a pure-text typeahead with no visual icons (Journada constraints don't need icons) is *enough* in this register, provided the dropdown rows offer a secondary metadata hint (parent pillar in Journada's case, equivalent to Bear's icon-as-disambiguator).

### 1.2 Raycast — Models bottom-sheet with curated rows + Beta badge
**Refero UUID:** `d0b3a5f8-affb-485f-bb15-0072469892bd`
**App:** Raycast (ID 257) · iOS

A frosted-glass bottom sheet titled "Models" with two rows ("Auto" with a yellow `Beta` badge, "Ray-1") and instant-tap selection (no Save button). What is load-bearing for Journada is the *secondary-metadata badge pattern*: a tiny rounded uppercase label sitting next to the row title clarifies provenance. This is the cleanest example of differentiating "system-curated" from "user-extended" without resorting to icons, color blocks, or section headers — exactly the cohabitation pattern Journada needs (`canonical` rows feel official, `user` rows show a small "yours" badge).

The existing `TagPicker.tsx` already implements this pattern (line 236-243: the `yours` chip on user rows, `parent_pillar` label right-aligned). The Raycast screen validates the choice.

### 1.3 FocusPomo — Tag picker grid with inline "+ New Tag"
**Refero UUID:** `1db7e1a6-a3eb-4f68-9977-0ccca1ef9ef1`
**App:** FocusPomo (ID 181) · iOS

A bottom-sheet "Select Tag" panel arranged as a 2-column grid of pill-shaped tag chips, with an orange `+ New Tag` cell occupying the top-left position (visually equal in weight to existing tags), each tag chip showing a colored dot for category and a `−` icon for removal. Curated and user-created tags coexist in one grid; the create affordance is *part of the grid*, not a button below it. Selected tags get a different chip background.

What this gives Journada: a precedent for putting the create affordance *inline* with the suggestions list. `TagPicker.tsx` already does this in dropdown form (line 249-263 — the `Add "{trimmed}"` row appears after filtered matches). FocusPomo confirms that grid form works equally well; for `ConstraintPicker` the dropdown form is the right call because constraint names are sentence-length ("only attack from closed guard"), not single tokens.

### 1.4 How We Feel — multi-tag pill grid with custom "+" affordance
**Refero UUID:** `2b16ad4d-c693-4959-b9c0-e6b7f702e4fe`
**App:** How We Feel (ID 14) · iOS · Dark mode

This onboarding screen shows three independent tag groups ("Where are you?", "What are you doing?", "Who are you with?"), each rendered as wrap-laid pill buttons with a circular **+** at the end of the row to add a custom option. Selected pills get a blue border + blue text. Same row coexistence of curated entries and user customs without segmentation — exactly the cohabitation Journada needs.

Notable: How We Feel's editorial register (large serif title "How are you feeling?", muted gray sub-copy on dark mode) is the closest aesthetic match to Journada in the Refero corpus. The forest-green / champagne palette can be substituted directly into this layout pattern.

### 1.5 LinkedIn — Skills chip cluster with "+ Add skill"
**Refero UUID:** `01ee1b5b-3542-4df5-aa6b-4922b6d31c18`
**App:** LinkedIn (ID 9) · iOS

A skills section showing previously-selected skills as removable green chips with `×`, with a separate `+ Add skill` outlined button below. While LinkedIn's chip color is wrong for Journada, the *post-selection chip strip with inline ×* is exactly what `TagPicker.tsx` already renders (line 162-195). LinkedIn's pattern confirms that placing the "Add" affordance *outside* the chip strip (below it, in the typeahead) is the dominant convention rather than inside the strip.

### 1.6 Spotify — Add to Playlist sheet with "New Playlist" prepended
**Refero UUID:** `305f9adc-4063-41a4-9102-a23ee52174bb` and `81482359-9136-4ab0-81f7-b7343e95c4da` (Suno cousin)
**App:** Suno (ID 126) · iOS · Dark mode

A bottom sheet titled "Add to Playlist" with `+ New Playlist` as the first row of the list, followed by existing playlists each with a thumbnail and circular checkbox on the right (filled pink when selected). The `+ New Playlist` row visually matches the existing-playlist rows — same height, same internal padding — so the create affordance feels like *one more option in the list*, not a separate primitive. Toast confirmation (`81482359-…`) shows "Added to 'Disguise'" when selection completes.

What this gives Journada: a strong reference for placing the inline "Create new constraint" affordance as the *last* item in the dropdown (which is how `TagPicker` already does it) or as the *first* item — Spotify suggests first-item placement is also valid when no query is yet typed but the user clearly wants to author.

### 1.7 Linear (web) — Label/owner picker with autocomplete
**Refero UUID:** `84744d5f-7abb-4bb9-8903-097750927e83` (Monday.com pattern, web; Linear-style)
**App:** Monday.com (ID 40) · Web

Three-column inline filter row (field / condition / value-tag-pills) with selected values shown inline as chips with light-blue background and `+1` overflow. While not a true Linear screen, this pattern — chip selection inline with the editor, no modal — is the editorial-web alternative to a popover picker. Useful as a direction for Journada's eventual desktop layout.

---

## Section 2 — Mixed-Pool Randomizer References

The Rep Roulette FAB pulls from one pool today. Adding a constraints pool means the user needs to choose source. Premium apps handle this either via segmented control, source-toggle inside a sheet, or a long-press menu. iOS-first.

### 2.1 Nike Training Club — Music Source modal at workout start
**Refero UUID:** `b4c450ca-f3b3-4e2e-a036-d43ad9eed9f5`
**App:** Nike Training Club (ID 57) · iOS · Dark mode

A modal titled "Music Source" with two list rows ("Apple Music", "No Music"), each with a left icon and right checkmark for selection. The source choice is a *prerequisite* to action (Start Workout button is below the modal). This is the simplest source-toggle pattern and the closest analog to "shuffle drill universe vs constraint universe": one taps a row, the modal stays, and one then commits with a downstream button.

For Rep Roulette, this maps naturally to a small sheet that appears *before* the spin, or as a settings modifier the user dials in once and forgets.

### 2.2 Raycast — Models picker (re-cited)
**Refero UUID:** `d0b3a5f8-affb-485f-bb15-0072469892bd`

The same Raycast Models sheet doubles as a randomizer-source pattern: it lets the user pick a "source" (Auto vs Ray-1) that then *colors* every subsequent action. This is the most natural fit for Journada's roulette: the source toggle lives in the spin overlay, not as a separate setting elsewhere.

### 2.3 Loóna — Sleep timer wheel-row picker
**Refero UUID:** `04dbe589-2a13-41f2-86cb-7a4e07101b33` (and selected-state sibling `41933a58-43eb-4499-9704-6192125bf06a`)
**App:** Loóna (ID 11) · iOS · Dark mode

Modal with vertical option list (Off / 30 min / 1 h / 3 h / 6 h), checkmark on the active row, large "Done" CTA at the bottom. Pure radio-row pattern. While this is duration not source, the *visual model* — sheet, list, tap-to-select, Done — translates 1:1 to a "Roulette Source" sheet. The aesthetic (deep dark background, subtle dividers, bold white) is also a closer match to Journada's forest-green dark mode than any fitness app shuffle UI.

### 2.4 Dropset — Equipment selector inside live-workout sheet
**Refero UUID:** `c8f97238-d9a3-40cd-b66b-493e36f3d694`
**App:** Dropset (ID 203) · iOS · Dark mode

A live-workout screen with a bottom sheet for picking equipment, each row showing a square checkbox + bold title + description + circular type icon. The relevance for Journada: it shows a *modifier* selection sheet that lives *adjacent to the action* (the workout is in progress; the equipment sheet refines what's used). For Rep Roulette this is the analog of "I'm about to spin — which pool?" living in the same surface as the spin button.

### 2.5 Dropset — "Add a workout / Tailored routine / Body metrics / Folder" action menu
**Refero UUID:** `ef3bdc6b-684d-4660-903d-1c04c78f7844`
**App:** Dropset (ID 203) · iOS · Dark mode

A bottom-sheet "Add" hub with four labeled rows, each containing icon + title + subtitle + right-side action button. This is the *FAB-action-menu* pattern: the FAB doesn't perform a primary action — it opens a hub of *which kind* of action to take. Perfectly applicable to Rep Roulette: a long-press on the FAB could open a hub showing "Spin a drill" / "Spin a constraint" / "Spin both" rather than burying the choice in a settings screen.

---

## Section 3 — Conditional Form-Field References (type discriminator drives field reveal)

Apps that gracefully change their form shape when a discriminator changes.

### 3.1 PayPal — Bank Deposit, conditional fields under "Routing" + radio "Checking"
**Refero UUID:** `fdac9c61-edcb-4eba-a644-d63978daac36`
**App:** PayPal (ID 213) · iOS

Form with discriminator (Inside Europe / Outside Europe segmented control above), and the IBAN / routing-number fields swap accordingly. Fields appear in vertical flow, no animation called out, no navigation — the layout simply reflows beneath the segmented control. The control itself is a pill-shaped two-tab segmented selector with a clear active state.

### 3.2 Wise — Inside / Outside Europe segmented bank-details form
**Refero UUID:** `ab153b75-acff-4bb0-931d-d69aa1643e75` and `e98ee2db-8a3b-4620-b550-86c9b863400e` and `920e623e-d392-48bd-8ab3-6b7c4c082f9f`
**App:** Wise (ID 39) · iOS

The same segmented-control-drives-fields pattern, but Wise's execution is the cleanest in the corpus: the segmented control sits directly above the fields it governs, fields appear in vertical document flow, no animation, no extra surface. When the user flips Outside → Inside, the field set redraws in place. State preservation is implicit (the user's email field above the discriminator is unaffected; only the discriminator-coupled fields change).

This is the canonical reference for Journada's CLA flip. The session-type discriminator (Class / Free Drilling / CLA) sits at the top of the form as a 3-segment pill; flipping to CLA causes the constraint picker to appear in vertical flow below it.

### 3.3 Train Fitness — "Custom Exercise" form with discriminator + conditional toggles
**Refero UUID:** `822c4a41-e8a5-483c-8159-5230a8966776`
**App:** Train Fitness (ID 211) · iOS · Dark mode

A form with `Exercise Type` segmented control (Reps / Distance / Time), three downstream toggles (Weighted Exercise / Double Weight / Unilateral Weight), and a muscle-group radio-list below. The relevant pattern: the segmented discriminator at the top doesn't navigate anywhere — it lives next to the fields it controls, and the visible-toggle set adapts to the type. Despite being a fitness app this screen is editorial enough (dark mode, clean type, no gamification) to cite without aesthetic baggage.

### 3.4 Train Fitness — "Generate Workout" form with optional advanced field
**Refero UUID:** `bb2d0d60-fdfc-491e-92a7-563cdaf99497`
**App:** Train Fitness (ID 211) · iOS

A form with Muscle Groups + Advanced Settings as collapsible rows and an "Add more information" multiline text field appearing below them. Demonstrates that a discriminator-coupled field can be *secondary* (always present but only used when the user wants to enrich the entry) rather than driven by a hard segmented control. Worth citing as a fallback if Journada decides CLA constraints are *optional* even when session type is CLA.

### 3.5 Square — Invoice form with row-level conditional fields (web)
**Refero UUID:** `403cde4b-3920-42d3-9283-3ecccb219e0d`
**App:** Square (web)

A clean light-theme invoice form where selecting a different field type at the row level changes the rest of the row's UI. While web-only and not directly applicable to Journada's mobile-first form, it confirms that the *vertical-flow reflow* pattern is platform-agnostic and the gold standard.

### 3.6 Train Fitness — Connect Apple Health permission modal
**Refero UUID:** `0bf24c34-09e6-495f-92bd-2cbdc7a05b9c`
**App:** Train Fitness (ID 211) · iOS

Tangentially related: this screen is the cleanest example of conditional content (info card with bullets) being presented in a way that preserves register without falling into a fitness-app voice. Cited as a tone reference for the CLA "what is this?" affordance the user may want next to the session-type segmented control.

---

## Section 4 — Anti-Patterns to Avoid

The CLA feature must not pull the rest of Journada toward gamification. Three anti-patterns from the contrast searches with specific UUIDs.

### 4.1 Duolingo — Streak celebration popup
**Refero UUID:** `9e82bb9c-cdcd-489d-87b2-3bdfed7c9f40` and `e3ac954a-8bca-4077-800d-b05302bde64e`
**App:** Duolingo (ID 5) · iOS

Bright orange flame mascot with sunglasses, "You're on a 1 day streak!", `SHARE` / `DISMISS` buttons, gamified profile with friend count and laurel-leaf level badges. The exact opposite of Journada's register. Notable anti-patterns: (a) anthropomorphic mascot, (b) achievement copy ("Brilliant!", "GO TO LEGENDARY"), (c) bright primary-color buttons used for emotional reinforcement rather than for primary CTAs. The Roulette FAB must never produce a celebratory animation when it lands on a constraint. A subtle haptic (consistent with the existing `vibrate(8)` in `TagPicker.tsx`) is the upper bound.

### 4.2 Duolingo — Achievements list with progress bars and gem icons
**Refero UUID:** `727db4b9-a921-401c-9801-5cc3d6c63dce`
**App:** Duolingo (ID 5) · iOS

Vertical list of "achievement cards" each with a colorful square level icon, level label, achievement title, description, and progress bar with numeric fraction. This is exactly what the Constraints Library must NOT become. Constraints are a *coaching primitive* (a rule mod), not a collectible. No level icons, no progress bars, no fraction labels.

### 4.3 Imprint — "Commit to learning" streak goal cards
**Refero UUID:** `9c195cc3-94cb-428f-9df2-07a3a4ed6255` and `84fb5b9a-5925-42a2-8055-d92e46ca9a32`
**App:** Imprint (ID 188) · iOS

"7 day streak — Good", "14 day streak — Great", "30 day streak — Amazing", "60 day streak — Incredible". Quantitative streak-goal commitment with adjective ladders. The aesthetic is closer to Journada's (light, minimal, gray) but the *idea* is wrong: pinning the user to a duration commitment via adjective gradient is the gamification trap. CLA constraints must never be presented as a streak ("you've trained under collar-choke-only for 4 sessions in a row").

### 4.4 Brilliant — Streak share modal with sticker assets
**Refero UUID:** `a945f255-4fd9-4ff3-aef0-bcbb6a87736e` and `d9525941-cd24-4d8d-a1cb-54b2ac1863d4`
**App:** Brilliant (ID 166) · iOS

Big trophy graphic, "1 day learning streak" with sparkles, share-to-Messages / Save Image / More. The "shareable streak" is the bottom of the gamification slope. Even Journada's copper/orange palette would feel wrong if pressed into a sparkles-around-a-number layout.

### 4.5 Foodvisor — Calorie streak confirmation card
**Refero UUID:** `0590e3dd-071b-4993-b48f-34a17594fe1b`
**App:** Foodvisor (ID 92) · iOS

Large flame icon with embedded "2", "day streak!", calendar dot row, "Good things always come in three..." motivational copy, full-width CTA. A representative example of the streak/badge stack Journada must avoid. Note specifically the *flame* metaphor — fire imagery is overloaded with gamification connotations and should not appear in Journada even as decorative iconography.

---

## Section 5 — Concrete Recommendations for Journada

Grounded in `TagPicker.tsx` (which is already a sound base) and the references above.

### 5.1 ConstraintPicker — extend TagPicker, do not duplicate it

The component should be a near-clone of `TagPicker` with three substantive differences:

1. **No `currentPillar` requirement.** Constraints can target one or more pillars, but the user shouldn't have to pre-tap a Prism vertex to add one. Default the create flow to "no parent pillar" and let the user assign a pillar in a follow-up step (or leave it null and resolve it server-side from the constraint's content).
2. **Longer chip text.** Constraints are sentence-length ("only attack from closed guard", "no using grips") rather than single tokens like position names. Chip rendering should wrap rather than truncate; consider switching from `text-xs` to `text-sm` and removing the inline pillar label inside the chip (move it to a tooltip or to the dropdown row only).
3. **Keep the "yours" badge convention.** The existing 9px uppercase tracked-widest pill on user rows (line 236-243 of `TagPicker.tsx`) is exactly right. It's the same pattern Raycast uses for `Beta`. Reuse the styling token, do not invent a new one.

Specific layout (mirrors `TagPicker`):
- Selected chips strip on top, copper background, `×` to remove. Sentence-length text wraps; allow chips to span multiple lines.
- Single text input with placeholder `"Search constraints or type to add…"`.
- Dropdown below input shows: canonical matches first (no badge), then user matches (with `yours` badge), then `Add "{trimmed}"` row last when no exact match exists.
- `Enter` selects first match; if no match, creates. Backspace on empty input removes most-recent chip. Same as `TagPicker` lines 142-156.
- Max-selected default of `1` for CLA forms (a session usually has one rule modification, not five). Make it a prop so the form can override.

This satisfies the canonical/custom cohabitation requirement (Section 1.2, 1.4, 1.6) without introducing a new visual primitive.

### 5.2 Roulette pool toggle — segmented control inside the spin overlay

The Rep Roulette FAB currently opens an overlay where a drill is presented. Add a 2- or 3-segment pill at the **top of the overlay** before the spin animation runs:

- `Drill` · `Constraint` · (optionally `Either`)

Use the same segmented-control visual the iOS Wise/PayPal screens use (Section 3.1, 3.2): pill-shaped two-tab control, active tab gets a slightly lighter forest-green fill (`SURFACE_3`) with copper text, inactive tabs are transparent with muted white text. Sit it above the spin button so the choice is *visible at the moment of action* rather than hidden in settings.

Persist the last-selected pool to localStorage so the user only chooses once per device. Do not surface this as an onboarding decision — make the default `Drill` (current behavior) so the toggle is invisible to users who don't care.

A long-press on the FAB itself can open the Dropset-style action hub (Section 2.5 — `ef3bdc6b-684d-4660-903d-1c04c78f7844`) as a power-user shortcut: long-press → bottom sheet with "Spin a drill" / "Spin a constraint" / "Cycle the segmented toggle". This is a delight feature — not a requirement for v1.

Avoid: a settings screen, a separate FAB, or a toast asking "which pool?" before each spin.

### 5.3 CLA conditional field appearance

Use the Wise/PayPal pattern (Section 3.1, 3.2). Concretely:

1. Place the session-type discriminator as a 3-segment pill at the top of the log form: `Class` · `Free Drilling` · `CLA`. Same visual as the roulette pool toggle for consistency. Active segment gets `SURFACE_3` fill + copper text.
2. When the user flips to `CLA`, the `ConstraintPicker` appears in vertical document flow below the discriminator, in the same position the tag picker already occupies. **No animation; no slide; no expand-in-place.** Just a layout reflow on the next render. This matches Wise's behavior and respects the editorial register (Day One and Bear never animate field appearance — they trust the layout to communicate).
3. **State preservation**: if the user types a constraint, then flips back to `Class`, then flips to `CLA` again, the typed constraint should still be there. Hold form state at the parent component (`SessionForm`), and gate visibility — not mounting — on `session_type === 'CLA'`. Keep the constraint chip array in form state regardless of session type.
4. **Optional**: add a small italicized hint below the picker on first-ever CLA selection: *"Constraints scope this session to a specific rule mod (e.g., 'submission only via collar choke')."* — Cormorant Garamond italic, 14px, 60% opacity. Hide after the first save with a localStorage flag.

If the user changes session type *after* saving constraints, surface a non-blocking confirmation: "Switching off CLA — keep the constraint(s) attached to this session anyway?" with `Keep` / `Remove`. This avoids accidental data loss without forcing a modal.

---

## Section 6 — Open Design Questions for the User

1. **Max constraints per session.** TagPicker defaults to 5. For CLA, is the realistic per-session count 1, 2, or up to 5? (The Refero patterns suggest 1 is dominant — Wise / PayPal / Train Fitness all use a single discriminator-driven field. If the answer is 1, the picker should display as a single-slot input rather than multi-select chips.)

2. **Pillar mapping for constraints.** Does every constraint need a `parent_pillar` (the way every tag does in `TagPicker.tsx`), or can constraints span multiple pillars (e.g., "no grips" affects standup AND passing AND guard)? The schema decision (single FK vs many-to-many) influences whether the chip shows one pillar label or none.

3. **Curated library curation policy.** Will `canonical_constraints` be hand-seeded (~30 entries by the user as expert) or community-sourced? This changes the dropdown's default empty state — hand-seeded means showing a "Browse curated" affordance even before typing; community means leaning purely on typeahead.

4. **Roulette toggle persistence — device or account?** localStorage is simpler; a backend-synced preference travels with the user. For a feature this lightweight, localStorage is recommended unless the user has multi-device sync ambitions for v1.

5. **CLA hint copy and tone.** The Section 5.3 hint copy was drafted in a coaching voice. Should it be phrased more reflectively (e.g., *"What rule are you training under tonight?"*) to match Journada's journal aesthetic? The Refero patterns generally use functional copy; Journada has license to use evocative copy because it's a personal-reflection tool, not a productivity utility.

---

## Appendix — UUIDs cited

| # | App | Platform | UUID | Section |
|---|---|---|---|---|
| 1 | Bear (Edit Tag, light) | iOS | `fa61a6a3-7e46-43fa-a349-696a14c0bcee` | 1.1 |
| 2 | Bear (Edit Tag, dark) | iOS | `beb55a9f-cdf6-44ff-b34f-29d4129c12b9` | 1.1 |
| 3 | Raycast (Models sheet) | iOS | `d0b3a5f8-affb-485f-bb15-0072469892bd` | 1.2, 2.2 |
| 4 | FocusPomo (Tag picker) | iOS | `1db7e1a6-a3eb-4f68-9977-0ccca1ef9ef1` | 1.3 |
| 5 | How We Feel (multi-tag pills) | iOS | `2b16ad4d-c693-4959-b9c0-e6b7f702e4fe` | 1.4 |
| 6 | LinkedIn (Skills chips) | iOS | `01ee1b5b-3542-4df5-aa6b-4922b6d31c18` | 1.5 |
| 7 | Suno (Add to Playlist) | iOS | `305f9adc-4063-41a4-9102-a23ee52174bb` | 1.6 |
| 8 | Suno (toast confirm) | iOS | `81482359-9136-4ab0-81f7-b7343e95c4da` | 1.6 |
| 9 | Monday.com (filter chips) | Web | `84744d5f-7abb-4bb9-8903-097750927e83` | 1.7 |
| 10 | Nike Training Club (Music Source) | iOS | `b4c450ca-f3b3-4e2e-a036-d43ad9eed9f5` | 2.1 |
| 11 | Loóna (Sleep timer rows) | iOS | `04dbe589-2a13-41f2-86cb-7a4e07101b33` | 2.3 |
| 12 | Loóna (selected state) | iOS | `41933a58-43eb-4499-9704-6192125bf06a` | 2.3 |
| 13 | Dropset (Equipment sheet) | iOS | `c8f97238-d9a3-40cd-b66b-493e36f3d694` | 2.4 |
| 14 | Dropset (Add hub) | iOS | `ef3bdc6b-684d-4660-903d-1c04c78f7844` | 2.5, 5.2 |
| 15 | PayPal (Bank Deposit, conditional) | iOS | `fdac9c61-edcb-4eba-a644-d63978daac36` | 3.1 |
| 16 | Wise (Inside/Outside Europe) | iOS | `ab153b75-acff-4bb0-931d-d69aa1643e75` | 3.2 |
| 17 | Wise (selected Inside) | iOS | `e98ee2db-8a3b-4620-b550-86c9b863400e` | 3.2 |
| 18 | Wise (Confirm with IBAN) | iOS | `920e623e-d392-48bd-8ab3-6b7c4c082f9f` | 3.2 |
| 19 | Train Fitness (Custom Exercise) | iOS | `822c4a41-e8a5-483c-8159-5230a8966776` | 3.3 |
| 20 | Train Fitness (Generate Workout) | iOS | `bb2d0d60-fdfc-491e-92a7-563cdaf99497` | 3.4 |
| 21 | Square (Invoice form) | Web | `403cde4b-3920-42d3-9283-3ecccb219e0d` | 3.5 |
| 22 | Train Fitness (Apple Health perm) | iOS | `0bf24c34-09e6-495f-92bd-2cbdc7a05b9c` | 3.6 |
| 23 | Duolingo (streak popup) | iOS | `9e82bb9c-cdcd-489d-87b2-3bdfed7c9f40` | 4.1 |
| 24 | Duolingo (course header) | iOS | `e3ac954a-8bca-4077-800d-b05302bde64e` | 4.1 |
| 25 | Duolingo (achievements list) | iOS | `727db4b9-a921-401c-9801-5cc3d6c63dce` | 4.2 |
| 26 | Imprint (streak goal) | iOS | `9c195cc3-94cb-428f-9df2-07a3a4ed6255` | 4.3 |
| 27 | Imprint (selected goal) | iOS | `84fb5b9a-5925-42a2-8055-d92e46ca9a32` | 4.3 |
| 28 | Brilliant (streak share) | iOS | `a945f255-4fd9-4ff3-aef0-bcbb6a87736e` | 4.4 |
| 29 | Brilliant (saved confirm) | iOS | `d9525941-cd24-4d8d-a1cb-54b2ac1863d4` | 4.4 |
| 30 | Foodvisor (streak card) | iOS | `0590e3dd-071b-4993-b48f-34a17594fe1b` | 4.5 |

Total: 30 distinct screens cited (above the 10–15 target — five of them are siblings of the same pattern within the same app, included to show variant states; the unique-pattern count is closer to 18).

`TagPicker.tsx` was read in full at `c:/Users/Rober/repository/Journada P2/project/J2/frontend_app/src/components/TagPicker.tsx` and the `ConstraintPicker` recommendation in Section 5.1 is a calibrated extension rather than a new component.
