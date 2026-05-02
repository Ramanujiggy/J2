# Onboarding Flow — Implementation Plan

**Status:** Proposed
**Created:** 2026-04-12
**Depends on:** [onboarding.md](onboarding.md) (design document)

---

## Summary

Add a 9-step onboarding wizard that runs once after registration. Collects training goal, experience level, belt rank, training frequency, focus areas, and home gym. Saves all data via the existing `PATCH /api/profile` endpoint. Redirects to `/home` on completion.

---

## Phase 1 — Database & API (Backend)

### 1.1 Create migration `006_onboarding_fields.sql`

Add 5 new columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN training_goal VARCHAR(50);
ALTER TABLE users ADD COLUMN experience_level VARCHAR(20);
ALTER TABLE users ADD COLUMN training_frequency VARCHAR(20);
ALTER TABLE users ADD COLUMN focus_areas TEXT[];
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET onboarding_completed = TRUE;
```

**Files:**
- `backend_api/migrations/006_onboarding_fields.sql` (new)

### 1.2 Update profile model

Extend `getProfile` and `updateProfile` to read/write the new columns.

**Files:**
- `backend_api/src/models/profileModel.ts`

### 1.3 Update profile controller & validation

Add the new fields to the Zod schema in the profile controller. Validate enum values for `training_goal`, `experience_level`, `training_frequency`. Validate `focus_areas` as an array of known pillar strings.

**Files:**
- `backend_api/src/controllers/profileController.ts`

### 1.4 Expose `onboarding_completed` in auth response

The login and register responses should include `onboarding_completed` so the frontend can decide whether to redirect. Update the auth controller to include this field in the JWT payload or the response body.

**Files:**
- `backend_api/src/controllers/authController.ts`

---

## Phase 2 — Onboarding Wizard (Frontend)

### 2.1 Create onboarding page & route

New page component at `/onboarding` — a wizard container that manages step state and renders the current step component.

**Files:**
- `frontend_app/src/app/OnboardingPage.tsx` (new)
- `frontend_app/src/app/App.tsx` (add route)

### 2.2 Create step components

Each step is a small, focused component receiving `onNext`, `onBack`, and `onSkip` callbacks.

| Component | Step | Type |
|---|---|---|
| `WelcomeStep.tsx` | 1 | Static content + CTA |
| `NameStep.tsx` | 2 | Text input |
| `GoalStep.tsx` | 3 | Single-select cards |
| `ExperienceStep.tsx` | 4 | Single-select cards |
| `BeltStep.tsx` | 5 | Visual belt selector + stripes |
| `FrequencyStep.tsx` | 6 | Single-select cards |
| `FocusAreasStep.tsx` | 7 | Multi-select cards |
| `GymStep.tsx` | 8 | Google Places input (reuse existing) |
| `LoadingStep.tsx` | 9 | Animated transition |

**Files:**
- `frontend_app/src/components/onboarding/` (new directory, 9 files)

### 2.3 Create shared onboarding UI components

Reusable pieces used across multiple steps:

| Component | Purpose |
|---|---|
| `ProgressBar.tsx` | Segmented progress indicator (8 segments) |
| `SelectionCard.tsx` | Tappable card with title, description, selected state |
| `StepLayout.tsx` | Consistent layout wrapper (back arrow, skip link, progress bar, CTA) |

**Files:**
- `frontend_app/src/components/onboarding/shared/` (new directory, 3 files)

### 2.4 Add redirect logic

After login/register, check `onboarding_completed`. If false, redirect to `/onboarding`. After onboarding completes, redirect to `/home`.

**Files:**
- `frontend_app/src/context/AuthContext.tsx` (store `onboarding_completed`)
- `frontend_app/src/app/App.tsx` (route guard)

### 2.5 Submit onboarding data

On Step 9 (loading screen), fire a single `PATCH /api/profile` with all collected data + `onboarding_completed: true`. Handle errors gracefully (retry or allow manual retry).

**Files:**
- `frontend_app/src/app/OnboardingPage.tsx`

### 2.6 Add step transitions

CSS slide-left / slide-right animations between steps. Keep it simple — CSS transitions or framer-motion if already in the project.

**Files:**
- `frontend_app/src/components/onboarding/shared/StepTransition.tsx` (new, or CSS-only)

---

## Phase 3 — Personalised Empty State

### 3.1 Update dashboard empty state

When a user first lands on `/home` after onboarding, show a personalised welcome instead of the current generic empty state. Use `training_goal` and `name` to customise the message.

Example: "Welcome, [Name]! Ready to log your first session? You said you're training to compete — let's track that journey."

**Files:**
- `frontend_app/src/app/HomePage.tsx`

---

## Phase 4 — Testing

### 4.1 Backend tests

- Migration applies cleanly
- Profile update accepts and validates new fields
- Auth response includes `onboarding_completed`
- Invalid enum values are rejected

### 4.2 Frontend tests

- Onboarding wizard navigates forward and backward
- Skip advances to next step
- Data is collected and submitted correctly
- Redirect logic works (unonboarded → `/onboarding`, onboarded → `/home`)

### 4.3 E2E tests

- Full onboarding flow (register → complete all steps → land on dashboard)
- Partial onboarding (register → skip all → land on dashboard)
- Resume onboarding (register → close browser → login → resume at `/onboarding`)

---

## Implementation Order

```
Phase 1 (Backend)          ~2–3 hours
  1.1 Migration
  1.2 Profile model
  1.3 Profile controller
  1.4 Auth response

Phase 2 (Frontend)         ~4–6 hours
  2.3 Shared UI components (build these first)
  2.1 OnboardingPage shell
  2.2 Step components (in order: Welcome → Name → Goal → Experience → Belt → Frequency → FocusAreas → Gym → Loading)
  2.4 Redirect logic
  2.5 Submit logic
  2.6 Transitions

Phase 3 (Polish)           ~1 hour
  3.1 Personalised empty state

Phase 4 (Testing)          ~2–3 hours
  4.1 Backend tests
  4.2 Frontend tests
  4.3 E2E tests
```

---

## File Change Summary

| Action | Path |
|---|---|
| **New** | `backend_api/migrations/006_onboarding_fields.sql` |
| Edit | `backend_api/src/models/profileModel.ts` |
| Edit | `backend_api/src/controllers/profileController.ts` |
| Edit | `backend_api/src/controllers/authController.ts` |
| **New** | `frontend_app/src/app/OnboardingPage.tsx` |
| **New** | `frontend_app/src/components/onboarding/WelcomeStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/NameStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/GoalStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/ExperienceStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/BeltStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/FrequencyStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/FocusAreasStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/GymStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/LoadingStep.tsx` |
| **New** | `frontend_app/src/components/onboarding/shared/ProgressBar.tsx` |
| **New** | `frontend_app/src/components/onboarding/shared/SelectionCard.tsx` |
| **New** | `frontend_app/src/components/onboarding/shared/StepLayout.tsx` |
| Edit | `frontend_app/src/app/App.tsx` |
| Edit | `frontend_app/src/context/AuthContext.tsx` |
| Edit | `frontend_app/src/app/HomePage.tsx` |

---

## Dependencies

- No new packages required
- Google Places autocomplete component already exists (reuse from Profile)
- Belt selector visual can be adapted from existing Profile belt rank selector
- Loading animation can reuse the existing belt-tying loader
