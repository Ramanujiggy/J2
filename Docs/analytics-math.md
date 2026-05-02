# Analytics Mathematical Models — Deep Dive

This document explains every non-trivial calculation in Journada's analytics system. It covers what each model computes, the exact formula, what the inputs and outputs mean, and where each is used.

Straight linear counting (total hours, session counts, date filtering) is excluded — this focuses on the models where the math shapes what the user sees.

---

## 1. Grappling Prism — Min-Max Normalization

**What it does:** Converts raw training hours per pillar into a [0, 1] scale for the radar polygon.

**Formula:**

```
normalized[i] = hours[i] / max(hours[0..4])
```

For 5 pillars with hours `[40, 25, 10, 5, 30]`:
```
max = 40
normalized = [1.0, 0.625, 0.25, 0.125, 0.75]
```

**What this means:**
- The largest pillar ALWAYS fills the entire radar radius (1.0).
- All other pillars are shown relative to the largest.
- This is **relative distribution only** — you can't tell absolute volume from the shape. A practitioner with 100 total hours and one with 10 total hours could produce identical Prism shapes if their proportions are the same.

**Floor value:** `Math.max(normalized[i], 0.02)` — any pillar gets at least 2% radius so it doesn't collapse to an invisible point. This is cosmetic, not analytical.

**Where:** `SkillRadar.tsx:154-156`

---

## 2. Grappling Prism — SVG Vertex Positioning (Polar-to-Cartesian)

**What it does:** Maps each pillar's normalized value to an (x, y) coordinate on a pentagon.

**Formula:**

```
angle = (2pi / 5) * i - pi/2
x = 50 + 38 * t * cos(angle)
y = 50 + 38 * t * sin(angle)
```

Where:
- `i` = vertex index (0 = standup, 1 = passing, 2 = pins, 3 = submissions, 4 = guard)
- `t` = normalized value (0.0 to 1.0)
- `50, 50` = center of the SVG viewBox
- `38` = radius in SVG units
- `-pi/2` = rotate so vertex 0 starts at the top (12 o'clock)

**What this means:**
- 5 vertices are evenly spaced at 72-degree intervals
- `t = 1.0` places the point on the outer ring
- `t = 0.5` places it halfway between center and edge
- The filled polygon shape is the visual "Prism"

**Grid rings:** Drawn at `t = 0.25, 0.50, 0.75, 1.00` — purely visual reference.

**Where:** `RadarChart.tsx:17-19`

---

## 3. Ambient Focus — Proportional Hours via `sessionPillarHours()`

**What it does:** Identifies which pillar dominated training in a given time window. Now uses **proportional weighting** — the contribution of a session is split across pillars by its `pillar_distribution` weights instead of crediting each tag with the full duration.

**Formula:**

```
sessionPillarHours(s) returns pillar → hours, in priority order:
  1. Use s.pillar_distribution if present (IDW weights from PillarPrism)
       hours[pillar] = totalHours * (weight[pillar] / sum_of_weights)
  2. Fall back to even split across s.tags (legacy sessions)
       hours[pillar] = totalHours / tags.length  for each tag
  3. Else {} (session contributes nothing)

For each session in the window:
  For each (pillar, hours) in sessionPillarHours(s):
    counts[pillar] += hours

Ambient Focus = argmax(counts)
```

**Worked example:**
- 2-hour session with `pillar_distribution = { guard: 0.7, passing: 0.3 }`
  → guard gets 1.4 h, passing gets 0.6 h. **Sum = 2.0 h** (matches total mat hours — zero-sum)
- Compare to legacy: a 2-hour session tagged `[guard, passing]` (no distribution) would credit guard 1.0 h and passing 1.0 h via the even-split fallback. Sum still equals total hours.

**What this fixes:**
- Old behavior: a 2-hour multi-tag session credited each tag with the full 2 hours, so the sum of pillar hours could exceed total mat hours.
- New behavior: zero-sum. Sum of pillar hours always equals total mat hours.
- The Prism, Ambient Focus, Entropy, Recency Decay, and per-pillar ACWR all use this same helper, so they're internally consistent.

**Where:** `analyticsUtils.ts` (`sessionPillarHours`, `topTagInRange`, `tagHoursInRange`); `SkillRadar.tsx` Prism aggregation; `PathAheadPage.tsx` windowStats; `AnalyticsPage.tsx` hoursMap.

---

## 4. Intention-Session Alignment — Graduated Score

**What it does:** Measures what percentage of your training hours matched your stated intention during that intention's window.

**Formula:**

```
tagHours = {standup: 2, guard: 8, passing: 5, ...}  (hours per pillar in the window)
totalHours = sum(tagHours)  = 15
matchHours = tagHours[intention.heading]  = 8  (if intention heading was "guard")
score = round((matchHours / totalHours) * 100)  = 53%
```

**Status determination:**

```
If intention.heading === topTag.value  -> "aligned"
Otherwise                               -> "diverged"
```

**What this means:**
- "Aligned" means your most-trained pillar matches your intention — you practiced what you said you would.
- The **score** (53%) tells you HOW aligned: did you spend all your time on-intention or was it a slim plurality?
- A week with 80% guard and 20% passing when your intention was guard shows "aligned, 80%" — much more informative than just "aligned".
- Legacy intentions (before the heading field) fall back to a word-overlap heuristic between the intention label text and the top tag label. This is fuzzy and can't produce a percentage score.

**Where:** `analyticsUtils.ts:62-94, 100-119`

---

## 5. Intention Brightness Gradient — Linear Decay

**What it does:** Makes the intention particle glow on DayCards brighter for days closer to today, fading out toward the end of the intention window.

**Formula:**

```
If duration == 1:
  brightness = 1.3  (constant, maximum)

If duration > 1:
  brightness = max(0.78, 1.3 - 0.52 * (daysFromToday / (duration - 1)))
```

Example for a 7-day intention:

| Day offset | Formula | Brightness |
|---|---|---|
| 0 (today) | 1.3 - 0.52 * (0/6) | 1.30 |
| 1 | 1.3 - 0.52 * (1/6) | 1.21 |
| 3 | 1.3 - 0.52 * (3/6) | 1.04 |
| 6 (last day) | 1.3 - 0.52 * (6/6) | 0.78 |

**What this means:**
- It's a CSS `brightness()` filter multiplier applied to the glowing particles on each day card.
- Days outside the intention window get a flat `1.15` (slightly bright but not glowing).
- The visual effect: the intention "radiates" from today and dims toward the future, like urgency fading with time.
- The range [0.78, 1.30] was tuned visually — 1.3 is a warm glow, 0.78 is barely perceptible.

**Where:** `PathAheadPage.tsx:193-202`, applied in `DayCard.tsx:81-82, 249`

---

## 6. Period-over-Period Delta — Percentage Change

**What it does:** Compares a metric (e.g. total hours) between the current time window and the equivalent prior period.

**Formula:**

```
Prior period = same duration, shifted back by that duration.
  e.g. 30d window: current = last 30 days, prior = 30-60 days ago.

delta = round(((current - prior) / prior) * 100)
```

**Edge cases:**
- `prior < 0.01` → returns null (avoids division by tiny numbers / zero)
- Positive delta → "^20%" (up arrow)
- Negative delta → "v12%" (down arrow)

**What this means:**
- Standard percentage change formula, not annualized or smoothed.
- Comparing 30-day windows: if you trained 40h this month and 30h last month, delta = +33%.
- Not available for custom date ranges (no "prior" equivalent).

**Where:** `SkillRadar.tsx:233-237`

---

## 7. Skill Entropy — Shannon Diversity Index

**What it does:** A single number (0 to 1) that answers "how well-rounded is my training?"

**Formula:**

```
H = -SUM(p_i * ln(p_i)) / ln(N)

Where:
  p_i = hours_in_pillar_i / total_hours
  N = 5 (number of pillars)
  ln = natural logarithm
```

**Worked example:**

Hours: `{standup: 10, passing: 10, guard: 10, pins: 10, submissions: 10}` (perfectly even)
```
p_i = 0.2 for all pillars
H = -(5 * 0.2 * ln(0.2)) / ln(5)
  = -(5 * 0.2 * -1.609) / 1.609
  = -(-1.609) / 1.609
  = 1.0  (maximum diversity)
```

Hours: `{standup: 0, passing: 0, guard: 50, pins: 0, submissions: 0}` (pure specialist)
```
p_guard = 1.0, all others = 0
H = -(1.0 * ln(1.0)) / ln(5) = -(1.0 * 0) / 1.609 = 0.0
```

Hours: `{standup: 5, passing: 30, guard: 30, pins: 5, submissions: 5}` (focused but not extreme)
```
total = 75
p = [0.067, 0.4, 0.4, 0.067, 0.067]
H = -(0.067*ln(0.067) + 0.4*ln(0.4) + 0.4*ln(0.4) + 0.067*ln(0.067) + 0.067*ln(0.067)) / ln(5)
  ≈ 0.58
```

**Labels:**
| Score | Label |
|---|---|
| < 0.30 | Specialist |
| 0.30 - 0.54 | Focused |
| 0.55 - 0.79 | Balanced |
| >= 0.80 | Well-rounded |

**Why Shannon Entropy:**
- It's the standard information-theoretic measure of diversity, used in ecology (species diversity), portfolio theory, and machine learning.
- Dividing by `ln(N)` normalizes to [0, 1] regardless of how many pillars exist. If we add a 6th pillar later, the scale doesn't change.
- It's sensitive to both the NUMBER of pillars trained and the EVENNESS of distribution. Training 3 pillars unevenly scores lower than training 3 pillars evenly.

**Where:** `analyticsModels.ts:28-48`, displayed in `SkillRadar.tsx` below the Prism breakdown.

---

## 8. Skill Recency Decay — Exponential Forgetting Curve

**What it does:** For each pillar, estimates how "fresh" your skill is based on time since last training, adjusted for total experience.

**Formula:**

```
Retention_i = e^(-t / tau_i)

Where:
  t = days since last session with this tag
  tau_i = BASE_TAU + SCALE * ln(1 + total_hours_i)
  BASE_TAU = 7   (base time constant: 1 week)
  SCALE = 14     (each doubling of hours adds ~14 days of retention)
```

**Time constant examples:**

| Total hours in pillar | tau (days) | Meaning |
|---|---|---|
| 0 | 7 | Brand new — decays in a week |
| 5 | 7 + 14 * ln(6) = 32 | Beginner — ~1 month retention |
| 50 | 7 + 14 * ln(51) = 62 | Intermediate — ~2 months |
| 200 | 7 + 14 * ln(201) = 81 | Advanced — ~3 months |
| 1000 | 7 + 14 * ln(1001) = 104 | Expert — ~3.5 months |

**Retention examples (with tau = 32 days):**

| Days since last session | Retention |
|---|---|
| 0 | 1.00 (100%) |
| 7 | 0.80 (80%) |
| 16 | 0.61 (61%) |
| 32 | 0.37 (37%) — half-life |
| 64 | 0.14 (14%) |

**What this means:**
- Based on the Ebbinghaus forgetting curve from cognitive science.
- The key insight: the MORE you've trained a skill, the SLOWER it decays. A purple belt's guard doesn't rust as fast as a white belt's because they've built deeper neural pathways.
- `ln(1 + total_hours)` gives diminishing returns: going from 0 to 10 hours adds much more retention than going from 100 to 110.
- The "rustiest" pillar is the one with the lowest retention score — this is surfaced on the home page.

**Where:** `analyticsModels.ts:58-112`, displayed in `StatStrip.tsx` as a tappable view.

---

## 9. ACWR — Acute-to-Chronic Workload Ratio

**What it does:** Compares your recent training intensity against your established baseline. Predicts injury risk and readiness.

**Formula:**

```
Load = duration_minutes * intensity   (per session)

Acute  = SUM(Load) over last 7 days
Chronic = SUM(Load) over last 28 days / 4   (weekly average)

ACWR = Acute / Chronic
```

**Zones:**

| ACWR | Zone | Meaning |
|---|---|---|
| < 0.80 | Deload | Undertrained relative to your baseline. Safe but losing fitness. |
| 0.80 - 1.30 | Sweet spot | Progressive overload without excessive spike. Optimal. |
| 1.31 - 1.50 | Caution | Elevated risk. You've ramped up faster than your body adapted. |
| > 1.50 | Danger | Spike zone. High injury probability. Consider lighter sessions. |

**Worked example:**

Week 1-3: 3 sessions/week, 90 min each, intensity 3
```
Weekly load = 3 * 90 * 3 = 810
Chronic (28-day avg) = 810
```

Week 4: Competition prep — 6 sessions, 120 min each, intensity 4
```
Acute (7-day) = 6 * 120 * 4 = 2880
ACWR = 2880 / 810 = 3.56 -> DANGER
```

Week 4 (lighter): 2 sessions, 60 min each, intensity 2
```
Acute = 2 * 60 * 2 = 240
ACWR = 240 / 810 = 0.30 -> DELOAD
```

**Why this model:**
- The ACWR (Acute-to-Chronic Workload Ratio) is used by professional sports teams (rugby, AFL, soccer) to manage athlete load.
- BJJ has a high injury rate. Practitioners often spike their training for competitions without realizing the biomechanical risk.
- The model captures something intuition misses: going from 3x/week to 6x/week isn't just "training hard" — it's a specific, quantifiable spike that predicts injury.
- `duration * intensity` as the load metric is a simplified version of TRIMP (Training Impulse) from exercise physiology. A more sophisticated version would use heart rate, but duration * RPE (intensity) is the standard when HR data isn't available.

**Where:** `analyticsModels.ts:120-156`, displayed in `StatStrip.tsx` and used in the analytics insight sentence.

---

## 9b. Per-Pillar ACWR (`computeACWRByPillar`)

**What it does:** Same Banister/Gabbett ratio, but partitioned across pillars using `pillar_distribution`. Surfaces injury risk that the global ACWR misses — total mat hours might be flat while one pillar's load tripled.

**Formula:**

```
For each session s within the chronic window (last 28 days):
  load_per_pillar = duration * intensity * weight_pillar    (weights from sessionPillarHours)
  if s in last 7 days:  acute[pillar]   += load_per_pillar
                        chronic[pillar] += load_per_pillar
  else:                 chronic[pillar] += load_per_pillar  (28-day → 4-week avg)

For each pillar:
  ACWR_pillar = acute[pillar] / (chronic[pillar] / 4)
  zone        = same thresholds as global ACWR (deload < 0.8, sweet 0.8–1.3, caution 1.3–1.5, danger > 1.5)
```

**Why this matters:** Joint-specific injuries map to pillar volume. A standup spike before a competition predicts knee strain; a submission spike predicts shoulder/elbow stress. The global ACWR can't see these patterns when total volume is stable.

**Spikiest pillar selection (`spikiestPillar()`):** From the array of per-pillar results, returns the one with the highest ratio that's in `caution` or `danger` (returns `null` when all pillars are safe). This is what gets surfaced in the StatStrip "spike" view and the AnalyticsPage insight sentence as Priority 0.

**Where:** `analyticsModels.ts` (`computeACWRByPillar`, `spikiestPillar`); `StatStrip.tsx` (rotates a "spike" view in only when there's a spike to show); `AnalyticsPage.tsx` (top of insight cascade — actionable injury warnings beat volume commentary).

---

## 10. Insight Sentence — Priority Cascade

**What it does:** Generates a single contextual sentence on the Analytics page based on the most relevant finding from all models.

**Priority order:**

```
0. Per-pillar spike (danger) -> "Standup load is spiking (1.8× your baseline). Mind your joints."
1. ACWR danger zone          -> "Your training load has spiked — ratio at 1.7. Consider a lighter session."
2. Volume up >= 20%          -> "Volume is up 33% from the prior period. Momentum."
3. Volume down <= -20%       -> "Volume is down 25% from the prior period. The mat is patient."
4. Entropy < 0.25            -> "You're deep in specialist mode — almost all Guard."
5. Entropy > 0.85            -> "Your game is well-rounded. Every pillar is getting time."
6. Rustiest < 40%            -> "Standup is getting rusty — 23 days since your last session."
7. Dominant skill            -> "Your training is gravitating toward Guard Passing."
8. Fallback                  -> "Keep showing up."
```

**What this means:**
- Injury risk (ACWR) takes top priority because it's actionable and time-sensitive.
- Volume swings are next because they reflect recent momentum/decline.
- Entropy and decay surface longer-term patterns.
- The sentence is regenerated every time the time window changes.

**Where:** `AnalyticsPage.tsx:286-312`

---

## Summary: Model Comparison

| Model | Type | Input | Output | Scale | Established? |
|---|---|---|---|---|---|
| **Prism normalization** | Min-max | Hours per pillar | 0-1 per pillar | Relative | Standard |
| **Ambient focus** | Argmax | Hours per tag in window | Single tag | N/A | Custom |
| **Alignment score** | Ratio | Intention heading vs. tag hours | 0-100% | Absolute | Custom |
| **Intention brightness** | Linear decay | Day offset, duration | 0.78-1.30 | Visual | Custom |
| **Period delta** | % change | Current vs. prior period | +/- % | Absolute | Standard |
| **Entropy** | Shannon index | Hours per pillar | 0-1 | Normalized | Information theory (1948) |
| **Recency decay** | Ebbinghaus curve | Days since, cumulative hours | 0-1 | Normalized | Cognitive science (1885) |
| **ACWR (global)** | Load ratio | 7-day vs. 28-day load | 0-5+ | Absolute | Sports science (Banister 1975, Gabbett 2016) |
| **ACWR (per-pillar)** | Load ratio | 7d vs 28d, partitioned by `pillar_distribution` | 0-5+ per pillar | Absolute | Same sports science basis, applied per pillar |

---

## Key Design Decisions

1. **Multi-tag sessions credit each tag fully.** A 2-hour session tagged `[guard, passing]` gives 2 hours to guard AND 2 hours to passing. There's no splitting. Rationale: the practitioner practiced both for the full duration.

2. **Alignment uses the top tag, not a threshold.** "Aligned" means the intention heading IS the single most-trained pillar. Even if you spent 35% on-intention and 30% on something else, you're aligned. The graduated score (35%) tells you more.

3. **ACWR uses duration * intensity, not just duration.** A 2-hour drilling session at intensity 2 and a 1-hour competition session at intensity 5 produce similar loads (240 vs 300). This captures that hard sessions stress the body more than long easy sessions.

4. **Decay uses cumulative ALL-TIME hours, not just the current window.** A practitioner with 200 lifetime hours of guard who takes 2 months off retains more than a practitioner with 10 lifetime hours who takes 2 months off. This matches how motor learning works.

5. **Entropy is normalized by ln(N).** If we add a 6th pillar in the future, the 0-1 scale still works without recalibrating thresholds.
