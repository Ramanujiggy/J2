# Atlas Analytics — Layout Research

*Research artifact for the next iteration of Atlas's Prism tab. Written 2026-04-25.*

---

## 0. Why this doc exists

The Prism tab inside Atlas works functionally — hero stats, time window, sub-view rail, BigPrism, hours-bar legend, diversity, selected-vertex panel, two-column sessions/intentions — but the user's read after the last polish pass was:

> "It's just not optimal for this. It kind of looks like it's clashing a little bit. It looks like an earlier iteration of this project with the more mature, sophisticated look that we have now."

That's not a "tighten the spacing" note. That's a "the architecture of the page is wrong" note. The cleanup that followed ("this cleanup is much better") closed the visible gaps, but the user is now asking the harder question: what *should* this page look like, given who it's for and what it's trying to do?

Two parallel asks landed in the same message:

1. **Deep research** — calibrated to the depth of `customer-research.md`, `customer-archetype.md`, and `product-offer.md` — on the optimal layout for this view.
2. **Possible rename** — "Prism" the *tab* may become "Analytics", because Prism is becoming the literal *visualization name* (the pentagon). The tab and the visualization shouldn't share a noun.

This doc is the answer to (1) and the rationale for (2).

---

## 1. The constraint stack

Every layout decision below sits on top of three locked layers. Recapping them keeps later sections honest.

### 1.1 The customer (from `customer-archetype.md`)

The buyer is a **serious BJJ hobbyist**, 30–40 years old. White or blue belt. Trains 2–4× per week. Treats jiu-jitsu the way they treat every other deep practice in their life: **as a craft to be studied**.

**Their language:**
- "I want to see the shape of my game."
- "I want to see patterns."
- "I want a lab notebook AND a memory book."

**What they explicitly recoil from:**
- Scoreboards. Streak counters. Badges. "Crush your goals."
- Calorie/fitness framing.
- Anything that turns reflective practice into a Strava feed.

**What the data view is FOR (not cosmetically — load-bearingly):**
- Long-horizon pattern surfacing. *"Here is the shape of how you have actually trained, over weeks and months and years, in a form that you could not see by scrolling through individual sessions."*
- Confirming or correcting the story they tell themselves about their training. *"I think I'm a half-guard guy" → the data either confirms or quietly contradicts that.*
- Surfacing drift. *"You said you were going to train passing this month. You trained mostly guard."*

### 1.2 The brand (from `brand-brief.md`)

**Reference apps:** Claude.ai, Day One, Oak Meditation, NYT, Aesop. **Anti-references:** Strava, Peloton, Nike, Duolingo.

**Lock-ins:**
- **Editorial restraint over dashboard density.** The page is a printed page first, an interface second.
- **Cormorant serif is reserved for the wordmark.** UI uses Plus Jakarta Sans. Editorial moments (page titles, section dek, big numbers) can use a serif treatment, but never on dense data text.
- **Color discipline:** PAGE_BG `#0D1A14` (forest), CARD_BG `#152E22`, COPPER `#C4915F`, PALE_YELLOW `#F2E4A8`. Copper is the only chromatic accent that should be in the picture. We are not a multi-color dashboard.
- **No hard chrome.** No drop-shadow stacks, no gradient borders, no busy dividers. Whitespace and typographic weight do the hierarchy.

### 1.3 The product offer (from `product-offer.md`)

The big idea: **"Your training has a shape. You just can't see it yet."**

The unique mechanism: **Long-Horizon Pattern Surfacing** — not session logging, not goal tracking. The thing this product does that nothing else does is *let the practitioner stand back and see months of training as a single shape*.

This means: **the Prism (the pentagon visualization) is not a chart on a page. It IS the page.** Everything else is supporting context for reading it.

This is the inversion that the current layout doesn't yet honor. Right now the page is structured like a generic analytics dashboard — hero stats strip, then sub-view rail, then chart, then panels. The Prism is one card among siblings. That's wrong for *this* product.

---

## 2. What's wrong with the current page (diagnosis)

Specific, not vibes. Reading the current `AtlasPage.tsx` and `AtlasPrismDeck.tsx`:

**2a. The hero stats strip eats the entrance.**
Three stat boxes (Hours / Sessions / Avg per week) sit at the top of the page in CARD_GLOW chrome. They're the first thing the eye lands on. The Prism — which IS the product — comes second. This inverts the load-bearing element of the page.

**2b. The sub-view rail competes with the Prism for attention.**
A 5-icon rail (Prism / Volume / Split / Format / Weekly) lives right above the visualization. The Prism is one of five modes, given equal visual weight to "Volume" and "Split." That's a denial of the brand thesis. Volume bars are not the thesis. The shape is the thesis.

**2c. The Selected Vertex panel reads as parallel content.**
When a user taps a vertex, a card with 4 stats + Recent Sessions + Intentions opens *next to* the Prism (or below it on narrow). It's structurally a peer. But it isn't peer content — it's the *zoom* on the Prism. The current layout doesn't communicate "you tapped, now you're reading deeper."

**2d. Card-stack texture.**
We have ~5 distinct card surfaces stacked vertically (hero strip, time-range bar, sub-view rail card, prism card, legend/diversity card, selected-vertex card). Even with consistent CARD_GLOW chrome, that many container edges is what makes the page read "dashboard-y." The reference apps (Claude, Day One, NYT) almost never stack 5 cards. They use whitespace and typographic hierarchy where we use card edges.

**2e. The page has no editorial frame.**
There's no kicker, no dek, no opening line. A Day One year-in-review or a Claude artifact view always opens with a written line that tells you what you're about to read. We open with the word "Atlas" and three numeric boxes. Cold open.

**2f. The word "Prism" is now overloaded.**
"Prism" is a *tab* in the Atlas top-rail (`Timeline · Prism · Library · Calendar`). "Prism" is also the name of the pentagon visualization itself. Inside the Prism tab, on the prism sub-view, we draw a Prism, with "Prism" in the headline. The word does too many jobs. This is a small fix that pays off elsewhere — see §6.

---

## 3. What real editorial-analytics products do

Four reference patterns surfaced from Refero search across journaling, habit, and editorial-style analytics products. None of these are "best practice" — they are specific tactics in shipped products that match our customer/brand frame.

### 3a. Clearful "Insights" pattern (clearful.com)

Clearful is a journaling app with a personal-growth posture — the closest direct analog to Journada in tone. Their Insights screen has three patterns worth lifting:

1. **Single centered narrow column.** No left rail full of nav. Page is a column ~640–720px wide with all content centered in the viewport. Generous gutters either side. Reads like a long-form article, not a control panel.

2. **One headline stat per zone, then evidence.** The "Activity Breakdown" page leads with TWO small cards side-by-side: `Most Activity: Wednesday` and `Least Activity: Thursday`. Tells the story in two words. THEN below them, a single full-width bar chart that shows the data behind the call. The headline is the punchline; the chart is the evidence. Not the other way around.

3. **Sub-page navigation, not in-page tabs.** Clearful's Insights doesn't put 5 sub-views inside one page. Each insight type (Activity Breakdown, Most Active Time, Progress) is its own page reached via sidebar. The page isn't trying to be five pages at once.

### 3b. Anthropic Console / Claude (anthropic.com)

Their cost dashboard at `console.anthropic.com/settings/cost` is the closest reference to our brand DNA in the wild. What's noticeable:

1. **Dark canvas, near-monochrome, single accent color.** Background near-black, sidebar selected item is a *very subtle* gray rounded rect (no glow, no border, no copper underline — just slight surface lightening). Their accent color in the dashboard is **copper/orange (#A75531, #A64824)** — same family as our COPPER `#C4915F`.

2. **Sans-serif everywhere, including big numbers.** Styrene + San Francisco. No serif anywhere in the data layer. They reserve any editorial flourish for marketing pages. This is the discipline `brand-brief.md` already states ("Cormorant reserved for wordmark") and which we've drifted from in some Atlas places.

3. **No card chrome.** Sections are demarcated by typographic hierarchy and spacing, not borders. Where there *is* a container edge, it's a 1px hairline at very low opacity, never a glow.

### 3c. Day One year-in-review pattern

Day One's stats screen on iOS (and similar journaling-app patterns: Clearful's mobile insights screen `ddc2fc4b-5cfb-4504-9abc-3c88bd6c9018`) leads with a **header sentence**, not a number. Something like *"Total Entries: 47 — your most active month was September."* The number is embedded in a sentence. The sentence does the editorial framing the number can't do alone.

This is the "lab notebook + memory book" feel: the data isn't a fact to acknowledge, it's a sentence to read.

### 3d. Linear / Notion analytics-as-content pattern

When Linear or Notion show analytics inside their product (project insights, workspace analytics), they:
- Lead with a single hero visualization, full-width, generously padded
- Use a tiny inline secondary nav (text links, not icons) for sub-views
- Avoid sidebar rails inside the analytics page — the workspace nav is already on the left
- Use stats as **annotations on the chart**, not as a separate strip above it

The current Atlas page violates the third point: we have the desktop rail on the left AND a sub-view rail on top. Two navigations for one page.

---

## 4. Design principles for Atlas Analytics

Synthesized from the constraint stack (§1) and the reference patterns (§3). These are the rules the layout in §5 has to obey.

**P1 — The Prism is the page, not a card on the page.**
The pentagon visualization is the load-bearing element. Everything else exists to support reading it. If a user only saw one piece of this page, it would be the Prism — and they would still understand what the page is for.

**P2 — Lead with a sentence, not a strip.**
Open with a one-line read of the user's training in this window. "47 hours of training across 5 pillars. Guard is your dominant focus." Not three stat boxes. The sentence frames what the visualization is going to show; the stat boxes don't.

**P3 — Hierarchy by typography and whitespace, not by card edges.**
Cap card chrome at 2 surfaces visible at once. Right now we have ~5. Sections are demarcated by 64–96px vertical space + a serif/jakarta hierarchy step, not by another bordered panel.

**P4 — One accent color in the data layer.**
Copper. That's it. Per-pillar tinting on the BigPrism vertex dots is fine because it's identity (which pillar is which), not data encoding. The supporting layout — bars, numbers, dividers — is on the copper / pale-yellow / muted-white triplet. No other hues.

**P5 — Sub-views are quiet, not loud.**
The 5 sub-views (Prism / Volume / Split / Format / Weekly) become a thin text-link toggle BELOW the Prism, not an icon rail above it. Default sub-view is the Prism itself. The other four are "see the same window cut another way" — supporting evidence, not a parallel feature.

**P6 — Selected vertex is a zoom, not a sibling.**
When a vertex is tapped, the page reveals a deeper read for that pillar — recent sessions, intentions, alignment trend. It does this *as a continuation of reading the page*, not as a peer card next to the Prism. Visually: it appears below the fold, the Prism stays above it, and the Prism's tapped vertex visibly anchors the section that follows.

**P7 — Analytics is not Activity. The page is reflective, not real-time.**
No "today" framing. No streaks. No "you're on fire." The page is what you read when you sit down with coffee on Sunday to think about how you've been training, not what you check between rounds.

---

## 5. Recommended layout

Below is the layout that follows from §4. Naming follows the §6 rename.

### 5.1 Page architecture (desktop)

```
┌─ Atlas top tabs: Timeline · Analytics · Library · Calendar ────────┐
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  KICKER:  ANALYTICS                                         │   │
│  │  DEK:     The shape of your training, last 30 days.         │   │
│  │                                                             │   │
│  │  [Time window pills, right-aligned]                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  READING SENTENCE:                                          │   │
│  │  "47 hours across 5 pillars. Guard is your dominant focus,  │   │
│  │   passing your most under-trained area."                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │                    [BIG PRISM, 560×560]                     │   │
│  │                                                             │   │
│  │                  (centered, full-bleed)                     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ── Hours per pillar ──────────────────────  [h | %]   ──── ────   │
│                                                                     │
│  Stand-up   ████░░░░░░░░░░░░░░  4.2h   13%                         │
│  Passing    ███░░░░░░░░░░░░░░░  3.0h    9%                         │
│  Pins       ███████░░░░░░░░░░░  7.8h   24%                         │
│  Subs       █████░░░░░░░░░░░░░  5.6h   17%                         │
│  Guard      ████████████░░░░░░ 12.0h   37%   ★                     │
│                                                                     │
│                                                                     │
│  ── Other views ─────────────────────────────────────────────      │
│  · Volume over time   · Gi/No-Gi split   · Format mix              │
│  · Weekly rhythm                                                    │
│                                                                     │
│                                                                     │
│  ───────────────────────────────────────────────────────────       │
│  (Below this fold, only when a vertex is tapped:)                  │
│                                                                     │
│  GUARD — selected                                                   │
│  19 sessions · 12.0h · 37% of training · ↑ from prior 30d          │
│                                                                     │
│  ┌──────────────────────────────┬──────────────────────────────┐   │
│  │ Recent guard sessions        │ Guard intentions             │   │
│  │  Apr 22 · 90 min · "DLR..."  │  Apr 1: "DLR sweeps" — 80%   │   │
│  │  Apr 18 · 60 min · "..."     │  Mar 18: "Closed guard" 100% │   │
│  │  ...                         │  ...                         │   │
│  └──────────────────────────────┴──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 The kicker / dek / sentence triad

Three lines of editorial framing, all typography, no chrome. Mirrors the way `customer-research.md` opens — kicker, headline, dek.

- **Kicker** (Plus Jakarta Sans, 11px, COPPER, letter-spacing +0.16em, uppercase): `ANALYTICS`
- **Dek** (Plus Jakarta Sans, 14–15px, white at 60%, regular weight): `The shape of your training, last 30 days.` (text dynamically reflects time window — "last 7 days," "this year," "Apr 1 – Apr 25")
- **Reading sentence** (Plus Jakarta Sans, 22–24px, PALE_YELLOW, 1.4 line-height, 65ch max-width): `47 hours across 5 pillars. Guard is your dominant focus, passing your most under-trained area.`

The reading sentence is generated from the data — it's not a hardcoded string. Three fragments stitched together:

1. *"{N} hours across {pillarsTrained} pillars."*
2. *"{topPillar} is your dominant focus"* (only if top pillar is >25%)
3. *"{bottomPillar} your most under-trained area"* (only if bottom non-zero pillar is <10%)

If any clause doesn't apply, drop it. If the user trained zero hours in the window, the sentence becomes *"No training logged in this window."* and the rest of the page goes empty-state.

This kills the hero stats strip — the numbers it carried (Hours, Sessions, Avg/week) move into the sentence + the legend below the Prism. We do not lose the data, we *narrate* it.

### 5.3 The Prism, full-bleed and centered

- 560×560 (current size kept).
- Centered horizontally in the page column.
- Page column is ~720–840px wide on desktop (matches the Day One / Clearful single-column-narrative pattern).
- No card behind it. The Prism sits on PAGE_BG. The radial-glow gradient inside the SVG provides whatever ambient surface it needs.
- Vertex labels stay in mixed case (current).
- The alignment overlay polygon stays. This is one of the genuinely new affordances and it earned its place.

This is the single biggest visible change from current: we *remove* the card chrome that's currently around the Prism, and we let it breathe.

### 5.4 Hours-per-pillar legend, inline beneath the Prism

The horizontal hours-bar legend (already exists) moves directly under the Prism, no card around it. Section header is a thin hairline rule + small caps label `HOURS PER PILLAR`. The `[h | %]` toggle sits at the right edge of that hairline rule.

Bars are rendered with a 1px copper-at-15% baseline and a copper-at-65% fill. No rounded ends, no gradient. The dominant-pillar star marker stays.

Diversity score moves into a one-line caption below the legend: *"Diversity: 0.81 — broad, balanced training."* — same narration treatment as the reading sentence at the top.

### 5.5 Sub-views as a quiet text rail

Replace the icon rail with a single horizontal text-link row, below the legend, at small size. Default selected is "Shape" (formerly "Prism" — see §6 rename rationale). Selected link is PALE_YELLOW; unselected are white-at-50% with copper-at-50% on hover.

```
Shape   ·   Volume   ·   Split   ·   Format   ·   Weekly
```

Clicking any of the other four swaps **only the visualization above** — the kicker/dek/sentence stay, the time window stays, the legend (where applicable) stays. This treats sub-views as "another way to look at the same window," which is what they actually are.

Mobile collapses this to a single segmented control.

### 5.6 Selected-vertex zoom — below the fold, anchored to the tap

Currently the selected-vertex panel can sit beside the Prism, fighting for visual weight. Replace with:

1. When a vertex is tapped, **the page scrolls** so the tapped vertex sits at ~30% from the top of the viewport (`scrollIntoView({block: 'start'})` on the zoom panel works fine — the Prism stays partly visible).
2. Below the Prism's full layout, a new section appears:
   - Section heading: pillar name in editorial size + small subtitle: `19 sessions · 12.0h · 37% of training · ↑ from prior 30d`.
   - Two columns underneath: Recent Sessions (left), Intentions for this Focus (right).
   - At narrow widths, columns stack.
3. A second click on the same vertex — or click elsewhere on the Prism background — collapses the section.
4. The visual link between vertex and zoom panel is a **subtle vertical copper hairline** running down the page from the tapped vertex's screen position to the section heading (think NYT data-graphic annotation lines). Optional polish, ship without if it complicates.

This makes the zoom feel like a *continuation of the page*, not a sibling card.

### 5.7 Mobile

Mobile follows the same architecture, single column:

1. Kicker / dek / time pills row (pills horizontal-scroll if needed)
2. Reading sentence (smaller — 18px)
3. BigPrism (responsive, ~92vw cap)
4. Hours-per-pillar legend
5. Sub-view segmented control
6. Selected-vertex section appears below, expanding only when vertex tapped

The mobile branch already exists from Phase 2 of the previous Atlas/Analytics merge; this just refines what fills it.

---

## 6. The "Prism" → "Analytics" rename

### 6.1 Why

The word "Prism" is doing too many jobs:
- **Tab name** in Atlas top rail (sibling to Timeline, Library, Calendar).
- **Sub-view name** inside that tab (sibling to Volume, Split, Format, Weekly).
- **Visualization name** — the pentagon shape itself, which is rendered by `<BigPrism>`, which is referred to as "the prism" in the brand voice.

When all three jobs share a noun, the page can't talk about itself. "Switch to the Prism sub-view of the Prism tab to see the Prism" is unutterable. The sentence in §5.2 — *"the shape of your training"* — depends on the visualization being a *shape* the user reads, not a *tab they're on*.

The fix is to free up the noun:

| Layer | Old | New |
|---|---|---|
| Atlas tab | Prism | **Analytics** |
| Sub-view inside that tab | Prism | **Shape** |
| The pentagon visualization itself | Prism | **Prism** (unchanged — this is the brand term and stays) |

Now "Prism" means exactly one thing — the visualization — which is the same thing it means in conversation, in the code (`BigPrism`), and in the brand voice. The tab is what category of content you're looking at (Analytics). The sub-view is which lens you're applying (Shape vs Volume vs Split). The Prism is the artifact you're reading.

### 6.2 Risk

Two bookmark/state risks:

1. **localStorage** — the existing key `j2-analytics-timeWindow` already uses "analytics" in the name (preserved across the prior Atlas/Analytics merge). No change needed; the rename is congruent.
2. **Atlas tab persistence** — if the tab id stays `'prism'` (only the user-facing label changes), any saved tab state continues to work. **Implement the rename as a label-only change**: keep `id: 'prism'` in the TABS array, change `label: 'Prism'` to `label: 'Analytics'`. No migration needed.

The sub-view rename ("Prism" → "Shape") is also label-only — the underlying type id stays `'prism'` to avoid breaking any persistence.

### 6.3 Phase ordering

The rename can land in two cuts:

- **Now (low-risk, safe to ship):** rename the Atlas tab label `'Prism'` → `'Analytics'`. One-line change. No layout change. Earns immediate clarity.
- **Later (with the layout work in §5):** rename the sub-view label `'Prism'` → `'Shape'`, and apply the layout overhaul.

This doc closes with the first cut shipped. The second cut waits for user review of the layout direction.

---

## 7. What we're explicitly not doing

To keep the recommendation honest — and to give the user something concrete to push back against — these are the choices that I considered and decided against.

**Not adding a "Compare to prior period" toggle.** Tempting (it's a strong reflective-practice affordance). But it's a second axis on top of the time window, doubles the data load, and the prior-period delta arrows in the reading sentence already carry the lightweight version. Revisit if the user asks.

**Not adding sparklines next to each pillar in the legend.** Would be visually beautiful and match the NYT data-graphic feel. But five sparklines is five new charts, and we're trying to *reduce* visual density per §4.P3. Revisit after the main layout lands.

**Not introducing a serif treatment for the reading sentence.** `brand-brief.md` reserves Cormorant for the wordmark. The reading sentence is editorial in *tone* but uses Plus Jakarta Sans in PALE_YELLOW at a generous size — that's enough to feel literary without violating the rule.

**Not removing the time-window pills.** They're load-bearing for the customer's reflective use case ("show me the last 90 days, last 6 months"). They're staying. Just relocated to the kicker row, right-aligned, at smaller size.

**Not collapsing the alignment overlay into the legend.** The overlay polygon on the Prism is the "what you said you'd train vs what you actually trained" affordance. It's one of the rare pieces of genuinely new data on this page. It earns its visual weight, it stays where it is.

**Not adding a "share this view" or export affordance.** Per `customer-archetype.md`: anti-scoreboard. The reflective practitioner is reading their own data, alone, on a Sunday. They are not posting it. Don't build for the shape they recoil from.

---

## 8. Implementation phasing

Mirroring the prior Atlas/Analytics merge phasing — each step independently shippable, each one rolls back cleanly to the prior step.

### Phase 0 — Tab rename only (immediate, ships with this doc)
- Change `label: 'Prism'` → `label: 'Analytics'` in the Atlas TABS array.
- Verify desktop top-rail reads `Timeline · Analytics · Library · Calendar`.
- No other change. No layout, no styling, no sub-view rename. The point is the noun frees up before the layout work begins.

### Phase 1 — Editorial frame + remove hero strip
- Replace hero stats strip with kicker / dek / reading-sentence triad.
- Pull data for the reading sentence from existing analytics utilities.
- Keep everything else as-is. This is the single biggest mood shift on the page, before any structural changes.

### Phase 2 — Remove Prism's card chrome, reformat legend
- Lift the Prism out of its card; let it sit on PAGE_BG.
- Move the hours-per-pillar legend directly below the Prism, no card.
- Diversity becomes a one-line caption.
- Verify visual weight of the page hasn't collapsed (the card chrome was doing some structural work; whitespace + hairlines need to do that work now).

### Phase 3 — Sub-view rail → text-link row
- Replace the icon rail with the text-link row beneath the legend.
- Rename `'Prism'` sub-view label to `'Shape'` (label-only, id stays `'prism'`).
- Mobile becomes a segmented control.

### Phase 4 — Selected-vertex zoom restructure
- Selected-vertex panel moves below all of the above (currently can sit beside the Prism).
- `scrollIntoView` on tap so the section is visible without losing context.
- Optional: vertical copper hairline annotation from vertex to zoom heading.

### Phase 5 — Mobile pass + accessibility audit
- Mobile vertical stack honors the new architecture.
- Keyboard nav: vertex tap-equivalent for keyboard focus + Enter.
- Color contrast audit on the new text hierarchy (kicker/dek/sentence at PAGE_BG must meet WCAG AA minima).

Each phase ends with a screenshot review checkpoint with the user, since the user said *"it kind of looks like an earlier iteration"* — the verdict on whether each phase moves toward "mature/sophisticated" is theirs, not the linter's.

---

## 9. Open questions for the user

Things this doc takes a position on but where the user may want to redirect:

1. **Reading sentence wording.** I've written *"47 hours across 5 pillars. Guard is your dominant focus, passing your most under-trained area."* Two questions: (a) is "dominant focus" the right phrase, or do you want something less hierarchical (e.g., "where you've spent the most time")? (b) is "under-trained area" too judgmental? Could be "your quietest pillar."

2. **"Shape" as the sub-view rename.** Other candidates considered: "Pentagon" (too literal), "Pillars" (collides with the data noun), "Profile" (collides with user profile). "Shape" lands closest to the brand voice — it's the word the customer uses ("the shape of my game"). But the user may have a stronger reading.

3. **Card chrome elsewhere on the page.** This doc only addresses the Atlas/Analytics tab. The other Atlas tabs (Timeline, Library, Calendar) currently have card chrome. Should the editorial-restraint principle propagate? Probably yes for Library, debatable for Calendar (which is intrinsically grid-shaped). Out of scope for this iteration.

4. **Position of the time-window pills.** I've placed them right-aligned in the kicker row. Alternative: a single-line below the dek. Alternative: in a sticky top-of-page band. Pick what feels right when the layout is in front of you.

---

## 10. Appendix — references inspected

Refero search yielded ~20 directly relevant screens. The patterns above are synthesized from:

- **Clearful Insights** (`clearful.com/#/insights`, multiple screen IDs) — single-column narrative analytics, headline-then-evidence pattern, journaling-app tone.
- **Anthropic Console — Cost** (`console.anthropic.com/settings/cost`) — dark monochrome, copper accent, no card chrome, sans-serif throughout.
- **Day One / Clearful mobile insights** — header-sentence-as-stat pattern, vertical stack, no decorative chrome.
- **Linear / Notion in-product analytics** — single hero visualization, inline secondary nav as text links.
- **Habit-tracker dashboards (Checker, FocusPomo, GrowPal)** — shown as anti-references for what we are NOT (segmented Day/Week/Month/Year toggles, calorie cards, gamified feel).

Full Refero result sets persisted under `c:/Users/Rober/.claude/projects/c--Users-Rober-repository/82784717-3785-4278-9a56-ea20c8059312/tool-results/` (search-result JSON dumps) for any future deep-dive.

---

*End of research artifact. Implementation begins with Phase 0 (tab rename only) — see commit log alongside this doc.*
