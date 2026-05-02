# Onboarding Flow — Design Document

**Status:** Proposed
**Created:** 2026-04-12
**Last updated:** 2026-04-12

---

## Overview

Journada currently drops users straight into an empty dashboard after registration. There is no guided onboarding — profile fields (name, belt rank, stripes, home gym) are discovered organically via the Profile page. This means the app can't personalise the first experience, and new users see a cold, empty state.

This document proposes a multi-step onboarding flow that collects key data, personalises the initial experience, and reduces time-to-first-session.

---

## Research Summary

Research was conducted via Refero (a database of real production app screens and flows) across 20+ fitness, education, and learning apps. Key apps studied: **Dropset** (gym tracker, 21-step flow), **GO Club** (fitness pedometer, 24-step flow), **Imprint** (education, 54-step flow), **Brilliant** (education), **Duolingo**, **Foodvisor**, **The Body Coach**, and several web SaaS onboarding flows.

### Patterns Observed

| Pattern | Prevalence | Notes |
|---|---|---|
| Welcome / value proposition screen | Universal | 1–3 slides, hero image, benefits, "Get Started" CTA |
| Account creation first | ~80% | Email/password or social auth before personalisation |
| Goal selection (single-select cards) | Universal in fitness/education | Asked first to frame remaining questions |
| Experience level (4 tiers) | ~90% in fitness/education | Beginner / Intermediate / Advanced / Expert with descriptions |
| Body metrics (height/weight/age) | Common in fitness | Wheel pickers — **not relevant for Journada** |
| Training frequency / schedule | ~70% in fitness | Days per week or specific day selection |
| Daily commitment / learning goal | ~80% in education | Time-per-day framing (e.g. 5 / 10 / 15 min) |
| Topic / interest multi-select | ~70% | Subjects, skills, or focus areas |
| "Building your plan" loading screen | ~60% in fitness | Psychological device — builds perceived personalisation value |
| Segmented progress bar | ~80% | Thin horizontal bar at top of each step |
| "Skip" as subtle text link | ~70% | Top-right corner or below CTA |
| Notification permission request | ~50% | Asked after personalisation, before dashboard |
| Social proof / testimonials | ~40% | App store badges, user quotes |

### Key Takeaways for Journada

1. **Goal-first**: Ask *why* the user is training before anything else — it frames everything after.
2. **Keep it short**: Fitness apps average 8–12 meaningful steps (excluding splash/loading). Journada should aim for **7–9 steps**.
3. **Cards over dropdowns**: Selection screens use large, tappable cards — not form inputs.
4. **Progress visibility**: A segmented progress bar at the top of every step is standard.
5. **Personalised loading screen**: Even a brief "Building your training path..." screen increases perceived value.
6. **Skip-friendly**: Every optional step should have a skip option, but the flow should feel fast enough that most users complete it.

---

## Proposed Onboarding Flow

### Flow Diagram

```
Register (existing)
    ↓
┌─────────────────────────┐
│  1. Welcome Screen      │  Brand intro + value prop
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  2. What's Your Name?   │  Text input (pre-fills profile.name)
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  3. Training Goal       │  Single-select cards
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  4. Experience Level    │  Single-select cards (4 tiers)
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  5. Current Belt Rank   │  Visual belt selector
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  6. Training Frequency  │  Single-select (days per week)
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  7. Focus Areas         │  Multi-select (skill pillars)
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  8. Home Gym (optional) │  Google Places autocomplete
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  9. Building Your Path  │  Branded loading screen (1–2s)
└────────────┬────────────┘
             ↓
        Dashboard (/)
     with personalised
       empty state
```

### Step-by-Step Detail

---

#### Step 1 — Welcome

**Purpose:** Brand introduction, set expectations, build excitement.

| Element | Detail |
|---|---|
| Hero | Martial arts illustration or Journada logo animation |
| Headline | "Track your journey on the mats" |
| Subtext | 2–3 bullet benefits: "Log sessions, set intentions, watch your game evolve" |
| CTA | "Get Started" (full-width button) |
| Skip | None — this is the entry point |

---

#### Step 2 — What's Your Name?

**Purpose:** Personalise subsequent screens ("Nice to meet you, [Name]!").

| Element | Detail |
|---|---|
| Prompt | "What should we call you?" |
| Input | Single text field, auto-focused, max 100 chars |
| CTA | "Continue" (disabled until non-empty) |
| Skip | "Skip" text link (name remains null) |
| Data saved | `users.name` |

---

#### Step 3 — Training Goal

**Purpose:** Understand *why* the user trains. Used for future content prioritisation and analytics framing.

| Element | Detail |
|---|---|
| Prompt | "What brings you to the mats?" |
| Selection type | Single-select, full-width rounded cards |
| Options | See [Data Collection — training_goal](#training_goal) |
| CTA | "Continue" (disabled until selection) |
| Skip | "Skip" text link |
| Data saved | `users.training_goal` (new column) |

---

#### Step 4 — Experience Level

**Purpose:** Calibrate expectations and future recommendations.

| Element | Detail |
|---|---|
| Prompt | "How would you describe your experience?" |
| Selection type | Single-select, 4 cards with icon + title + description |
| Options | See [Data Collection — experience_level](#experience_level) |
| CTA | "Continue" |
| Skip | "Skip" text link |
| Data saved | `users.experience_level` (new column) |

---

#### Step 5 — Current Belt Rank

**Purpose:** Sets the visual belt bar and enables progression tracking.

| Element | Detail |
|---|---|
| Prompt | "What's your current belt?" |
| Selection type | Visual belt cards — coloured rectangles representing each belt |
| Options | White, Blue, Purple, Brown, Black (+ stripes sub-selector if belt chosen) |
| CTA | "Continue" |
| Skip | "Skip" text link (belt remains null) |
| Data saved | `users.belt_rank`, `users.stripes` (existing columns) |

---

#### Step 6 — Training Frequency

**Purpose:** Set realistic expectations, used for weekly summary context.

| Element | Detail |
|---|---|
| Prompt | "How often do you train?" |
| Selection type | Single-select cards |
| Options | See [Data Collection — training_frequency](#training_frequency) |
| CTA | "Continue" |
| Skip | "Skip" text link |
| Data saved | `users.training_frequency` (new column) |

---

#### Step 7 — Focus Areas

**Purpose:** Pre-populate skill interests, inform Grappling Prism initial state.

| Element | Detail |
|---|---|
| Prompt | "What areas of your game do you want to develop?" |
| Selection type | Multi-select cards (tap to toggle, 1+ required if not skipped) |
| Options | See [Data Collection — focus_areas](#focus_areas) |
| CTA | "Continue" |
| Skip | "Skip" text link |
| Data saved | `users.focus_areas` (new column, TEXT[]) |

---

#### Step 8 — Home Gym (Optional)

**Purpose:** Community features (future), location context.

| Element | Detail |
|---|---|
| Prompt | "Where do you train?" |
| Input | Google Places autocomplete (existing component, degrades to plain text) |
| CTA | "Continue" |
| Skip | "Skip" or "I train at home / multiple gyms" link |
| Data saved | `users.home_gym_name`, `users.home_gym_address`, `users.home_gym_place_id` (existing columns) |

---

#### Step 9 — Building Your Path

**Purpose:** Psychological transition — makes the user feel the app is preparing something personalised.

| Element | Detail |
|---|---|
| Visual | Animated belt-tying illustration (reuse existing loader) or martial arts silhouette |
| Text | "Building your training path..." → transitions to "Ready. Let's roll." |
| Duration | 1.5–2 seconds (animated, not a real computation) |
| Behaviour | Auto-advances to dashboard |

---

## Data Collection

### New Columns on `users` Table

<a id="training_goal"></a>
#### `training_goal` — VARCHAR(50), nullable

Why the user trains. Single-select during onboarding.

| Value | Card Label | Card Description |
|---|---|---|
| `competition` | "Compete" | "I want to win medals and compete at tournaments" |
| `self_defense` | "Self-Defence" | "I want to be able to protect myself" |
| `fitness` | "Stay Fit" | "Training is my primary form of exercise" |
| `discipline` | "Personal Growth" | "Building discipline, focus, and resilience" |
| `progression` | "Belt Progression" | "I'm working toward my next belt" |
| `fun` | "Love the Art" | "I just enjoy training and learning" |

<a id="experience_level"></a>
#### `experience_level` — VARCHAR(20), nullable

Self-reported experience tier. Single-select during onboarding.

| Value | Card Label | Card Description |
|---|---|---|
| `none` | "Brand New" | "I haven't started yet or just had my first class" |
| `beginner` | "Beginner" | "Less than a year of training" |
| `intermediate` | "Intermediate" | "1–3 years, comfortable with fundamentals" |
| `advanced` | "Advanced" | "3+ years, competing or teaching" |

<a id="training_frequency"></a>
#### `training_frequency` — VARCHAR(20), nullable

How often the user trains per week. Single-select during onboarding.

| Value | Card Label | Card Description |
|---|---|---|
| `1_2` | "1–2 times" | "Getting started or fitting it in around life" |
| `3_4` | "3–4 times" | "Consistent training, solid routine" |
| `5_plus` | "5+ times" | "Training is a major part of my life" |

<a id="focus_areas"></a>
#### `focus_areas` — TEXT[], nullable

Skill areas the user wants to develop. Multi-select during onboarding. Values align with the existing pillar headings used in session logging.

| Value | Card Label |
|---|---|
| `standup` | "Standup / Takedowns" |
| `passing` | "Guard Passing" |
| `guard` | "Guard / Sweeps" |
| `pins` | "Pins / Escapes" |
| `submissions` | "Submissions" |

<a id="onboarding_completed"></a>
#### `onboarding_completed` — BOOLEAN, NOT NULL, DEFAULT FALSE

Flag to track whether the user has completed (or skipped) the onboarding flow. Used to decide whether to redirect to `/onboarding` or `/home` after login.

---

### Existing Columns Used

| Column | Step | Already exists |
|---|---|---|
| `name` | Step 2 | Yes |
| `belt_rank` | Step 5 | Yes |
| `stripes` | Step 5 | Yes |
| `home_gym_name` | Step 8 | Yes |
| `home_gym_address` | Step 8 | Yes |
| `home_gym_place_id` | Step 8 | Yes |

---

## UI / UX Specifications

### Progress Bar
- Thin segmented bar at the top of every step (Steps 1–8)
- 8 segments, filled segments use the app's copper/warm accent colour
- Current segment is highlighted, completed segments are solid, upcoming segments are muted

### Navigation
- **Back arrow** (top-left) on Steps 2–8 to go to previous step
- **Skip** (top-right) as subtle text link on Steps 2–8
- **Continue** as full-width primary CTA at the bottom of each step
- Continue button is disabled until a valid selection/input is made

### Layout
- Single-column, centred content
- Max-width ~480px (same as login/register forms)
- Mobile-first — cards are full-width on mobile, 2-column grid on wider screens for Step 7 (focus areas)

### Transitions
- Slide-left animation between steps (slide-right on back)
- Subtle fade-in for card options

### Colours & Theme
- Consistent with existing Journada dark theme
- Card selection state: copper/warm accent border + subtle background tint
- Belt cards in Step 5: actual belt colours (white, blue, purple, brown, black)

---

## Routing & State

### New Route
- `/onboarding` — protected route (requires auth), renders the onboarding wizard

### Redirect Logic
```
After login / register:
  if (!user.onboarding_completed) → redirect to /onboarding
  else → redirect to /home
```

### State Management
- Local component state for current step and selections
- All data saved to backend in a single `PATCH /api/profile` call at Step 9 (before the loading animation completes)
- If the user closes the browser mid-flow, they'll be redirected back to `/onboarding` on next login (since `onboarding_completed` is still false)
- On the final save, `onboarding_completed` is set to `true`

---

## API Changes

### `PATCH /api/profile`

Extend the existing profile update endpoint to accept the new fields:

```json
{
  "name": "string",
  "belt_rank": "string",
  "stripes": "number",
  "home_gym_name": "string",
  "home_gym_address": "string",
  "home_gym_place_id": "string",
  "training_goal": "string",
  "experience_level": "string",
  "training_frequency": "string",
  "focus_areas": ["string"],
  "onboarding_completed": true
}
```

No new endpoints needed — the onboarding flow submits through the existing profile update.

---

## Migration Required

### `006_onboarding_fields.sql`

```sql
-- Add onboarding fields to users table
ALTER TABLE users ADD COLUMN training_goal VARCHAR(50);
ALTER TABLE users ADD COLUMN experience_level VARCHAR(20);
ALTER TABLE users ADD COLUMN training_frequency VARCHAR(20);
ALTER TABLE users ADD COLUMN focus_areas TEXT[];
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users are considered onboarded (they've been using the app)
UPDATE users SET onboarding_completed = TRUE;
```

---

## Personalisation Opportunities

Data collected during onboarding can be used to enhance the app experience:

| Data | How It's Used |
|---|---|
| `training_goal` | Frame analytics insights ("You said you're training to compete — here's your competition prep breakdown") |
| `experience_level` | Adjust tooltip verbosity, show/hide advanced features |
| `training_frequency` | Weekly summary context ("You aimed for 3–4 sessions this week — you hit 3!") |
| `focus_areas` | Highlight relevant pillars on the Grappling Prism, suggest session headings |
| `belt_rank` | Visual belt bar (already used), progression tracking |
| `home_gym` | Future: community features, gym leaderboards |
| `onboarding_completed` | Route guard, analytics segmentation (new vs returning users) |

---

## Open Questions

1. **Should onboarding be re-enterable?** If a user skips most steps, should there be a "Complete your profile" prompt on the dashboard?
2. **Notification permissions?** The PWA already handles this — should onboarding include an explicit notification opt-in step?
3. **Martial art type?** Journada currently focuses on BJJ. Should we ask "What do you train?" (BJJ / Judo / Wrestling / MMA) for future multi-art support?
4. **Training days?** Should we ask *which* days they train (Mon–Sun selector) for smarter weekly planning?
