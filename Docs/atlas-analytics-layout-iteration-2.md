# Atlas Analytics — Layout Assessment, Iteration 2

*Follow-up research artifact, written 2026-04-27. Pairs with `atlas-analytics-layout-research.md` (the v1 plan that shipped).*

---

## 0. Context

The v1 plan (sticky time band + reading sentence + chrome-less Prism + text-link sub-view rail) shipped in commit `a6c499a`. The user has reviewed it on production and the verdict is:

> "It looks fine, but it still doesn't look like a web page; it looks like a presentation, almost like it being in the center of the page doesn't make it better."

That's a precise objection. v1 fixed the *card-stack* problem (too many bordered panels stacking vertically). It did NOT fix the *layout-axis* problem: every piece of content sits on the same vertical centerline, with the same ~720px max-width, on a 1600px+ desktop viewport. The eye has only one axis to travel — top to bottom. That is the geometry of a slide deck, not a web page.

**This doc is the v2 plan: keep the editorial restraint v1 earned, but stop treating the page like a Keynote.**

Scope is the **top two-thirds** of the Atlas Analytics tab, per the user's direction:
- Sticky time-range band
- Reading sentence
- BigPrism (the visualization, including its vertex labels)
- Hours-per-pillar legend + diversity readout
- Sub-view text-link rail

The selected-vertex zoom (the bottom third) is out of scope for this iteration — it works as a "below the fold" continuation pattern, and will adapt naturally once the top is settled.

---

## 1. Why "centered + narrow" reads as a slide

Specific, not vibes.

**1a. Single focal axis.**
Every block sits stacked on a 720px-wide center column. The eye never has to look sideways. In a slide, that's the point — you deliver one beat at a time. On a web page, it's a tell. Web pages have multiple things happening simultaneously, and the user's eye scans laterally across them.

**1b. Content-to-canvas ratio is wrong.**
At 1680×900 desktop, the centered column uses ~43% of the viewport width. Of the remaining 57%, about half is the page padding (which is fine) and the rest is empty negative space flanking the column. That's not "generous whitespace" — it's *abandoned canvas*. The reader feels a quiet "is this loading?" because the layout has visible holes where content could live.

**1c. The Prism is alone.**
After the v1 lift, the BigPrism sits centered with no neighbor. A pentagon visualization with vertex labels reading "Stand-up / Guard / Passing / Pins / Subs" is *expecting* a legend on its hip. Without one, it reads as a hero ornament — the kind of thing you'd put on a marketing landing page above a "Get Started" CTA.

**1d. The hours-per-pillar legend is buried.**
The legend that used to sit beside the Prism (in v1's predecessor) now lives below it, behind a hairline rule labeled `HOURS PER PILLAR`. Reading the magnitude of each pillar now requires *scrolling*. The two pieces of data — the *shape* and the *amounts* — are physically separated when they should be coupled.

**1e. The sub-view rail is centered too.**
"Other views: Shape · Volume · Split · Format · Weekly" runs along a centered horizontal line at the bottom. It looks like a footer — like the page is over. In real analytics products, view-switchers anchor to a *side* (left rail or right rail) so they read as persistent navigation, not as a closing credit.

**1f. The page header is doing a different job than the page body.**
At the top of every Atlas tab: `ATLAS / Look back at your training. / Where the patterns show up — across weeks, months, and years.` That's beautiful editorial copy *for the Atlas surface as a whole*. But on the Analytics tab specifically, the reading sentence below it ("47h across 5 pillars. You've spent the most time on Guard.") is a *second* editorial frame. Two consecutive editorial frames is one too many — the second one feels redundant because it lives in the same vertical column as the first.

---

## 2. Reference patterns — what real analytics web pages do

From Refero, focused on dashboards that match our brand DNA (dark, restrained, editorial-leaning) AND on what *web pages* look like that *aren't* slides.

### 2a. Linear Insights (`linear.app/insights`)
Dark canvas. Charts and tables sit *side-by-side*, not stacked. Sub-view nav is a left rail. Stats live as small annotations *attached to* the chart, not as a separate strip. The visualization always has a neighbor.

### 2b. Vercel Analytics (`vercel.com/analytics`)
Multi-column rhythm: hero chart on the left two-thirds, summary cards (Real Experience Score etc.) on the right. The page reads horizontally first, vertically second. Notably, the brand uses *generous* horizontal space — they're not afraid of wide.

### 2c. Dub.co Analytics (`app.dub.co/.../analytics`)
Sidebar nav (left) + header bar with date range and filters (top) + KPI tiles in a horizontal row + main chart full-width. **Date range is a control bar, not a sticky band** — sits inline with other controls, all on one row. Cleaner than ours.

### 2d. ElevenLabs music sharing (`elevenlabs.io/.../share`)
A 2-column main content area: settings on the left, output preview on the right. Both columns left-aligned, equal vertical rhythm. The visualization (the album-art preview) and its supporting controls are *adjacent* — never stacked. This is the pattern closest to what Atlas Analytics should be.

### 2e. NYT data graphics (general pattern)
A chart with **typographic annotations beside it** — small labeled callouts hooked to specific data points or zones. The chart is one column, the annotations are another. The reader looks at the chart and, as the eye pans right, the annotations explain what just landed in view. This is editorial data viz at its best, and it matches our brand reference set.

### 2f. Clearful Insights (`clearful.com/#/insights`)
Worth noting as a *partial* pattern: Clearful uses a centered narrow column, but their dataset is much sparser than ours (one bar chart per insight type, displayed one at a time). When the dataset is multi-dimensional like ours (pentagon + 5 magnitudes + diversity + 4 alternative views), the Clearful pattern collapses. Ours needs Linear/Vercel/ElevenLabs scale, not Clearful's.

### 2g. The "anti" reference
Any product landing-page hero. A centered visualization with a centered headline above it, alone in white space — that's the "marketing slide" pattern. Atlas Analytics in v1 accidentally landed in that pattern. We're trying to climb out.

---

## 3. Design principles for v2

Carry forward from v1:
- Editorial restraint (no card-stack chrome)
- One accent color in the data layer (copper)
- Reading sentence as the editorial frame
- BigPrism is the load-bearing element

Add for v2:
- **The Prism has a neighbor.** The hours-per-pillar legend lives *adjacent* to the Prism, not below it. They're a two-element unit — shape on the left, magnitudes on the right.
- **Use the horizontal canvas.** On desktop, the page should fill ~85% of the viewport width with content, not 43%. Whitespace becomes asymmetric (more breath above and below than to the sides).
- **Navigation anchors.** The sub-view switcher anchors to a side, not a center line. The eye should always be able to glance to the same spot to switch views.
- **Stats as annotations, not as headers.** Small typographic labels beside the data, not stat-card grids on top of the data.
- **Editorial frame in one place.** Either the page-level Atlas header *or* the analytics-level reading sentence — not both stacked. The Atlas header retreats; the reading sentence becomes the page's primary kicker on the Analytics tab.

---

## 4. Recommended layout — asymmetric two-column

The structural move is: take everything that was stacked vertically below the Prism (legend, diversity, sub-view rail) and place it *to the right of* the Prism in a second column. The Prism takes ~60% of the content width; the supporting column takes ~35%, with a narrow gutter between.

### 4.1 Desktop wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ┌─ ATLAS top header ──────────────────────────────────────────────────────┐  │
│ │ atlas / Look back at your training. / Where the patterns show up...     │  │
│ │                                                       [Tab toggle]      │  │
│ └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ┌─ Sticky time-range band (compact, full-bleed minus padding) ──────────┐   │
│ │  [7D 2W 30D 3M 6M 1Y All] · Apr 1 – Apr 27, 30 days                   │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ ┌─ Reading sentence row (full content-width, left-aligned) ─────────────┐   │
│ │  47h across 5 pillars. You've spent the most time on Guard.           │   │
│ │  LAST 30 DAYS                                                         │   │
│ └────────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│ ┌─ Two-column workspace ──────────────────────────────────────────────────┐  │
│ │                                                                        │  │
│ │ ┌──────────── LEFT (60%) ────────────┐  ┌─── RIGHT (~35%) ──────────┐ │  │
│ │ │                                    │  │ HOURS PER PILLAR    [h|%] │ │  │
│ │ │                                    │  │ ───────────────────────── │ │  │
│ │ │                                    │  │ Stand-up    ████░  4.2h   │ │  │
│ │ │                                    │  │ Passing     ███░░  3.0h   │ │  │
│ │ │       [BIG PRISM 560×560]          │  │ Pins        █████  7.8h   │ │  │
│ │ │       (lives here, alone           │  │ Subs        ████░  5.6h   │ │  │
│ │ │        in its column,              │  │ Guard ★    ██████ 12.0h   │ │  │
│ │ │        centered vertically)        │  │                           │ │  │
│ │ │                                    │  │ DIVERSITY                 │ │  │
│ │ │                                    │  │ 0.81 — broad, balanced    │ │  │
│ │ │                                    │  │                           │ │  │
│ │ │                                    │  │ ───────────────────────── │ │  │
│ │ │                                    │  │ OTHER VIEWS               │ │  │
│ │ │                                    │  │ Shape (current)           │ │  │
│ │ │                                    │  │ Volume                    │ │  │
│ │ │                                    │  │ Split                     │ │  │
│ │ │                                    │  │ Format                    │ │  │
│ │ │                                    │  │ Weekly                    │ │  │
│ │ └────────────────────────────────────┘  └───────────────────────────┘ │  │
│ │                                                                        │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│ ─────────────────────────────────────────────────────────────────────────    │
│ [Selected vertex zoom — unchanged from v1]                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 What this changes vs v1

| Element | v1 (current prod) | v2 (proposed) |
|---|---|---|
| BigPrism position | Centered in 720px column | Left column of 2-col grid, vertically centered in row |
| Hours-per-pillar legend | Below the Prism, full-width within 720px column | Right column, top section, sits adjacent to Prism |
| Diversity readout | One-line caption below legend | Right column, second section, hairline-separated |
| Sub-view rail | Centered horizontal text links at bottom | Right column, third section — vertical text rail (like a sidebar) |
| Reading sentence | Centered in 720px column | Left-aligned, full content-width, sits above the 2-col workspace |
| Page-level "Look back at your training" header | Lives above tabs, all caps small kicker + 72px serif headline | **Compresses on Analytics tab**: kicker stays, headline shrinks to 24-28px or hides, italicized dek hides — the reading sentence becomes the primary headline for this view |
| Sticky time band | Full-bleed sticky with backdrop-blur | Same, but slightly tighter padding (10px vertical, not 14px) — the band is a control bar, not a hero zone |

### 4.3 Why this works

**The Prism gets a neighbor.** Hours-per-pillar legend is now anchored to the Prism's right hip. The reader's eye scans Prism → legend in one horizontal sweep, exactly the way they naturally read the data. Magnitude and shape become a unit, not two separated reads.

**Sub-view rail becomes navigation, not a footer.** Vertical text rail on the right reads as a persistent switcher — like a tab strip rotated 90°. The user always knows where to look to change view, and the rail isn't competing with content for vertical real estate.

**The page reads horizontally first.** Eye lands on reading sentence (top, left-aligned), pans down to the Prism (left column), pans right to the legend (right column), looks down for sub-views. That's a *web reading pattern*, not a slide reading pattern.

**The horizontal canvas is filled.** At 1680px wide with 64px page padding either side, the content area is ~1552px. Two columns at 60/35 with a 60px gutter use ~1490px of that — almost all of it. No more abandoned space.

**The Prism can grow.** Currently 520px. In a 60%-of-1552 column = ~930px wide, a 600–640px Prism fits comfortably with breathing room. Larger Prism = more legible vertex labels, more visible alignment overlay, more presence. (We can keep 520 if 600 feels too dominant — to be tuned in implementation.)

### 4.4 Other sub-views (Volume / Split / Format / Weekly)

The two-column grid stays. What changes is the right column's content:

- **Volume**: Right column shows monthly stat strip (Total / Peak month / Avg per month / Δ vs prior period).
- **Split**: Right column shows Gi vs No-Gi totals + ratio.
- **Format**: Right column shows Class / Drill / Comp totals + ratio.
- **Weekly**: Right column shows Total / Active weeks / Peak week / Avg per week.

All four sub-views' right columns also retain the **OTHER VIEWS** vertical rail at the bottom — the rail is constant, the breakdown above it varies. That keeps the visual rhythm uniform across sub-views.

---

## 5. BigPrism vertex labels — assessment

Current labels (in [BigPrism.tsx:268-305](Journada%20P2/project/J2/frontend_app/src/components/atlas/BigPrism.tsx#L268)):
- Plus Jakarta Sans, 14px, weight 500/700 (700 when active)
- Color: white-65% inactive, PALE_YELLOW active
- Position: anchored at vertex point with directional offset (+/-22px x, +/-28px y)
- Content: pillar `label` only (e.g., "Guard"), no value
- Click handler: selects the vertex

**Assessment:** Labels are functional, well-positioned, properly anchored. Two refinements worth considering:

**5a. Size relative to Prism scale.** At 14px on a 520px Prism, labels are ~2.7% of the Prism height. If the Prism grows to 600–640px in v2, labels should grow proportionally to ~16–17px. They're currently a bit too quiet on the larger canvas.

**5b. Don't double-encode magnitude.** The legend on the right column will carry the hours/% values. Labels on the Prism stay as pillar names only. Resist the temptation to add "Guard 12h" inline on the chart — that's a "summary card on top of a chart" anti-pattern, and it makes the Prism cluttered. Labels = identity. Legend = magnitude. Clean separation.

**5c. Active state is good.** When a vertex is selected, the label goes PALE_YELLOW + bold + drop-shadow glow. Combined with the larger filled circle marker, the active state is clearly readable. Keep as-is.

**5d. Mixed-case is correct (already shipped).** Stand-up, Guard, Passing, etc. — sentence case, not all-caps. Editorial register matches the page tone.

No structural changes to the labels are recommended — just bump font-size proportionally if/when the Prism grows.

---

## 6. Sticky time-range band — assessment

Current band ([AtlasPage.tsx:665-695](Journada%20P2/project/J2/frontend_app/src/app/AtlasPage.tsx#L665)):
- Position: sticky, top 0
- Background: rgba(13,26,20,0.92) + 8px backdrop-blur
- Border-bottom: 1px copper-at-10%
- Negative margins to span edge-to-edge
- Padding: 14px 64px on desktop

**Assessment:** Functionally correct and visually clean. Two refinements:

**6a. Tighten vertical padding.** A control bar should be a *thinner* presence than a content section. 14px → 10px vertical padding makes it read as utility, not as a feature zone. Visual weight of a control bar should be sub-content level.

**6b. Add the active window text inline.** Currently the time-range bar is just pills (`7D 2W 30D 3M 6M 1Y All Custom`). The active window's label ("Apr 1 – Apr 27, 30 days") could live to the right of the pills, in small caps, white-at-40%. Gives the band a second function: it doesn't just *let you change* the window — it *tells you what the active window is* in human-readable form. This also lets the reading sentence drop the trailing window label (which currently says "LAST 30 DAYS" beneath the sentence — redundant if the band carries it).

**6c. Sticky overlap with page header.** When the user scrolls down, the page header ("Look back at your training") scrolls away and the band sticks to viewport top. That's correct. But on scroll-up to the page top, there's a moment where the band sits below the header at scroll=0, and the header is visually *louder* than the band — which is right, because the band is utility. So the relationship works as-is.

**6d. Consider integrating sub-view tabs into the band.** A power move: when the band is sticky-pinned, also pin the sub-view switcher into it. Then on scroll-down, the user has a single sticky toolbar at the top with [time pills] [active window text] [sub-view tabs]. This is the Dub.co / Linear pattern. Optional — only if mocks confirm it doesn't make the band too wide for narrower viewports.

---

## 7. Reading sentence — assessment

Current sentence ([AtlasPage.tsx:697-733](Journada%20P2/project/J2/frontend_app/src/app/AtlasPage.tsx#L697)):
- Cormorant 28px (desktop), centered
- Below: WINDOW LABEL in small caps, also centered

**Assessment:** Sentence text is good (post-softening per user feedback). Layout positioning needs one change.

**7a. Left-align it.** Centered text in a 720px column on a wide viewport is the slide-deck giveaway. Left-aligning the sentence breaks that geometry immediately. The page's hierarchy becomes: a left-aligned editorial sentence at the top, then the two-column workspace below it.

**7b. Drop the trailing window-label line if §6b lands.** The window label moves into the time-range band. The sentence becomes a single line, no caption.

**7c. Width.** Constrain the sentence to ~50–55ch (max ~640px) for typographic line length, but anchor it left, not center. Whitespace flows to the right of the sentence — and that whitespace becomes a *visual rest* that makes the eye drop down to the workspace. Composed asymmetry.

---

## 8. Hours-per-pillar legend — assessment

Currently lives inside `AtlasPrismDeck.renderBreakdownContent('prism')` ([AtlasPrismDeck.tsx:419-484](Journada%20P2/project/J2/frontend_app/src/components/atlas/AtlasPrismDeck.tsx#L419)).

Format per row: `[8x8 color square]  [Pillar name + ★ if dominant]  [bar]  [value]`

**Assessment:** The row format is good. What changes is the surrounding context:

**8a. Width.** In v2 it lives in a ~480px-wide right column. The bar can grow from BAR_MAX_PX = 80 to ~140 — more visual range for the reader to read shape from.

**8b. Bar visual weight.** Currently bars use the per-pillar color at 0.45 opacity (in hours mode) or pale-yellow at 0.25 opacity (in percent mode). For more presence in the right column, consider a single-tone bar (copper-at-50%) with the pillar dot still in its color. That keeps "color = pillar identity" for the dot, and "magnitude = neutral copper" for the bar. Removes the busy-ness of 5 different bar colors.

**8c. Section title.** Currently a hairline rule + small-caps `HOURS PER PILLAR` label. Keep, but right-align the [h | %] toggle on the same line (already does, but verify in the new column width).

**8d. Diversity readout.** Currently a one-liner below the legend ("Diversity: 0.81 — broad, balanced training"). In v2 it gets its own small section in the right column, hairline-separated from the legend above. Still one line, but with a small-caps `DIVERSITY` label above the value. Treats it as a peer datum to the legend, not an afterthought.

---

## 9. Sub-view rail — assessment

Current rail ([AtlasPrismDeck.tsx:660-697](Journada%20P2/project/J2/frontend_app/src/components/atlas/AtlasPrismDeck.tsx#L660)): horizontal text links separated by `·`, centered at the bottom of the deck.

**Assessment:** The horizontal text-link pattern is correct (text > icons matches editorial register). Position is wrong — bottom-centered makes it read as a footer.

**9a. Vertical orientation in v2.** In the right column, render the rail vertically:
```
SHAPE      ← active (PALE_YELLOW + GLOW_SOFT)
Volume     ← inactive (white-50%)
Split
Format
Weekly
```

**9b. Active marker.** A 2-3px copper vertical line on the left of the active label, indented 8px. Like a sidebar nav marker. Or a `→` arrow before the active label. Pick one; both work.

**9c. Hover.** On hover, inactive items shift to copper. (Already implemented in v1.)

**9d. Spacing.** 16px vertical gap between items. Tight enough to read as a unit, loose enough that each item is independently tappable.

**9e. Section label.** A small-caps `OTHER VIEWS` label above the rail, hairline-separated from the diversity section above. Same treatment as `HOURS PER PILLAR` and `DIVERSITY`.

---

## 10. Page-level header — assessment

Currently at [AtlasPage.tsx:154-166](Journada%20P2/project/J2/frontend_app/src/app/AtlasPage.tsx#L154):
```
atlas
Look back at your training.
Where the patterns show up — across weeks, months, and years.
                                                              [Tab toggle]
```

72px serif display, italic dek, all 44px below it the tab toggle.

**Assessment:** Beautiful. Works on Timeline, Library, Calendar tabs. Competes with the reading sentence on the Analytics tab.

**10a. Compress on Analytics tab specifically.** When `tab === 'prism'`:
- Keep the kicker (`atlas`) and the tab toggle.
- Drop the 72px headline and the italic dek.
- The reading sentence becomes the primary editorial frame for the view.

**10b. Or: keep the headline, drop the dek.** A middle path. Headline at half size (32–36px), no dek. The reading sentence then carries the specifics.

**10c. Recommended:** option 10a. Two editorial sentences in close vertical proximity is one too many. Let the page-level frame yield to the view-level frame on this tab.

---

## 11. Implementation phasing

Each phase independently shippable, each one rollable back to the prior step.

### Phase 1 — Two-column workspace (the structural move)
- Wrap BigPrism + right-column-content in a 2-col grid (60/35 or 65/35).
- Move hours-per-pillar legend from below-Prism into the right column.
- Move diversity readout into the right column.
- Move sub-view text rail from bottom-centered into a *vertical* rail at the bottom of the right column.
- Mobile: stays single-column, vertical stack — no change.

This is the change that does 80% of the work. Verify visual smoke before continuing.

### Phase 2 — Reading sentence left-aligned
- Reading sentence: `textAlign` flips from `center` to `left`.
- Constrain to ~640px max-width, anchored left within the page padding.
- Drop the trailing WINDOW LABEL line (moves to time-range band — see Phase 4).

### Phase 3 — Page header compress on Analytics tab
- Conditional rendering: when `tab === 'prism'`, render only the kicker + tab toggle.
- Other tabs (Timeline, Library, Calendar) retain the full header.

### Phase 4 — Time-range band tightening
- Vertical padding 14px → 10px.
- Add active window text inline ("Apr 1 – Apr 27, 30 days") to the right of the pills.
- Optional: add sub-view tabs to the band when sticky-pinned (skip if it complicates).

### Phase 5 — Bar visual weight + Prism size tuning
- Hours-per-pillar bars: switch to single-tone copper bar with per-pillar dot (color stays in dot only).
- BigPrism: experiment with bumping size from 520 → 600 to fill the new column. Bump label font-size proportionally (14 → 16–17). Tune in browser, not in code.

### Phase 6 — Mobile audit
- Confirm mobile vertical stack still works after the changes.
- Confirm the time-range band doesn't get too cramped.
- Confirm vertex labels on a smaller mobile Prism (280px) don't shrink below readable.

---

## 12. What we're explicitly not doing in v2

- **Not changing the BigPrism's structural design.** Pentagon stays pentagon. Alignment overlay stays. Animation behavior stays. Vertex selection stays.
- **Not adding new data.** No new charts, no new metrics, no new comparisons. v2 is purely a layout move.
- **Not changing the selected-vertex zoom.** Below the fold, hairline-separated, two-column sessions/intentions panel — works, leave it.
- **Not introducing card chrome back onto the workspace.** The two columns sit on PAGE_BG, separated by whitespace + (optional) a single vertical hairline rule between them. No bordered panels.
- **Not making the page fixed-width.** The 60/35 split is proportional. At 1280px viewport: Prism column ~720px, right column ~420px. At 1920px: Prism column ~1100px, right column ~640px. The Prism itself caps at ~640px regardless — it doesn't keep growing forever.
- **Not adding hover tooltips on the Prism vertices.** Current click-to-select behavior is sufficient. Tooltips would clutter.

---

## 13. Open questions for the user

1. **60/35 vs 65/35 vs 70/30 split.** I've defaulted to 60/35 (with 5% gutter). 70/30 makes the Prism more dominant; 60/35 makes the right column more readable. Pick what feels right when the layout is in front of you.

2. **Page header compress vs. preserve.** I'm recommending fully compressing the page header on the Analytics tab (option 10a). Alternative: keep a smaller version of the headline (32–36px). The middle path costs one more vertical strip. Pick on visual.

3. **Sub-view tabs in the sticky band (§6d).** Optional, would let users switch views from anywhere on the page after scroll. Adds visual weight to the band. Pick after Phase 1-3 land.

4. **BigPrism size.** Stay at 520 vs. bump to 600. The bumped version uses the new column width better but may overwhelm the legend on the right. Easiest to A/B in dev tools after Phase 1.

5. **Bar tone — single copper vs per-pillar color.** Per-pillar color is identifying but busy at 5 bars. Single copper is calmer but loses the "this bar IS that pillar" visual hook. Pick on vibe.

---

## 14. Appendix — references inspected (Refero searches)

- "linear analytics insights dashboard chart" — Linear Insights, page-types Product Page & Landing
- "vercel analytics dashboard web vitals" — Vercel Analytics product page, `vercel.com/analytics`
- "stripe dashboard revenue chart breakdown" — multiple Stripe and Stripe-adjacent dashboards
- "analytics two column chart breakdown side panel" — Dub.co Analytics (`app.dub.co`), the closest match
- "posthog dashboard insights dark" — Clearful again (already inspected for v1)
- "whoop oura ring health insights chart" — sparse for desktop web
- "dashboard chart left sidebar filter navigation rail" — ElevenLabs (`elevenlabs.io`) sharing/share patterns

Result JSON dumps persisted under `c:/Users/Rober/.claude/projects/c--Users-Rober-repository/82784717-3785-4278-9a56-ea20c8059312/tool-results/`.

---

*End of v2 plan. Phase 1 (two-column workspace) is the highest-leverage change — recommend shipping it as a single PR, reviewing against production, then continuing with phases 2–6.*
