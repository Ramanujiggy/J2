# Journada — Brand & Design Brief

A comprehensive brief for designers, AI collaborators, and anyone helping evolve Journada's visual language. Written to be pasted/uploaded to design tools.

---

## 1. What Journada Is

Journada is a **training journal for martial artists** — primarily Brazilian Jiu-Jitsu practitioners. It helps users log sessions, set weekly intentions, track skill alignment, and reflect on their progression.

It is **not** a fitness tracker, a gym app, or a social network. It is a personal reflection tool disguised as a practical logger.

**Target user:** Serious practitioners who see their training as a craft. They're not counting calories or chasing PRs — they're tracking their relationship with a complex skill over years. Think: the thoughtful hobbyist who also keeps a fountain pen, reads on paper, and appreciates good coffee.

**Target platforms:** iOS and Android (PWA today, native apps planned). Mobile-first, with dedicated desktop layouts for reflection/analytics sessions.

---

## 2. Brand Voice & Tone

**Voice:** Quiet confidence. Meditative but grounded. Never motivational, never macho.

**Writing examples (real, from the app):**
- "Two weeks. The mat is starting to know you."
- "Eight weeks. You show up. That is the whole secret."
- "Half a year. Every week. The mat remembers."
- "The Prism is what you earn by having a broad game, not what we impose."
- "Tap or drag to mark your training focus"
- "Log a Training Session" (not "Log Workout", not "New Entry")

**What the voice avoids:**
- ❌ Exclamation points
- ❌ Emojis (no fire 🔥, no streak counters, no confetti)
- ❌ "Crushing it" / "Beast mode" / any gym-bro register
- ❌ Gamification language (XP, levels, achievements)
- ❌ Urgency or FOMO ("Don't miss your streak!")
- ❌ Social pressure ("Your friends are training")

**What the voice embraces:**
- ✅ Sparse, deliberate sentences
- ✅ Martial arts philosophy where appropriate (restraint, consistency, presence)
- ✅ Second-person perspective that respects the user ("You show up")
- ✅ Acknowledging time and craft ("The mat remembers")

---

## 3. Visual Brand Core

### The Reference Feel
Journada should feel like the intersection of:
- **A well-made leather notebook** — tactile, considered, built to last
- **A dojo at dawn** — quiet, reverent, disciplined
- **Claude.ai's interface** — warm, crafted, restrained, premium without being loud
- **The Japanese seigaiha (wave) pattern** — geometric, timeless, in motion

### Apps it should NOT feel like
- Strava (too sporty)
- Peloton (too performance-driven)
- MyFitnessPal (too utilitarian)
- Duolingo (too gamified)
- Nike Training Club (too brand-forward)

---

## 4. Color System

### Surfaces (dark forest palette)
| Token | Hex | Usage |
|---|---|---|
| `PAGE_BG` | `#0D1A14` | Page background — deep forest green, almost black |
| `CARD_BG` | `#152E22` | Raised cards and modals |
| `SURFACE_2` | `rgba(255,255,255,0.035)` | Sub-section containers inside cards |
| `SURFACE_3` | `rgba(255,255,255,0.08)` | Interactive controls, inputs, chips |

### Accent (warm metallics)
| Token | Hex | Usage |
|---|---|---|
| `PALE_YELLOW` | `#F2E4A8` | Champagne gold — page titles, primary accents, glow |
| `COPPER` | `#C4915F` | Caramel metallic — card borders, active toggle fills, wave strokes |
| `#DA7422` | — | Brand orange — primary CTAs only (Log Session, Save) |

### Intensity scale (for session data)
| Level | Hex | Meaning |
|---|---|---|
| 1-2 | `#A8CB72` | Light / Easy — sage green |
| 3 | `#52B56C` | Moderate — forest green |
| 4 | `#D4A040` | Hard — warm amber |
| 5 | `#DA7422` | Max — brand orange |

### Glows (the "living" quality)
- `GLOW_TITLE`: `0 0 14px rgba(242,228,168,0.45), 0 0 32px rgba(242,228,168,0.2)` — on the "Journada" wordmark
- `GLOW_SOFT`: `0 0 14px rgba(242,228,168,0.3), 0 0 30px rgba(242,228,168,0.14)` — on section headings
- Glows are used *sparingly*, to make champagne text feel lit from within

### Color philosophy
- Hierarchy comes from **opacity**, not saturation (white at 90/60/40/22% for primary/secondary/tertiary/hint text)
- No bright colors. No pure white. No pure black. Everything is warm-toned.
- The red patch on a black belt (`#C41E3A`) is the only "saturated" color, and it only appears once in the app

---

## 5. Typography

### Current System
- **Body, labels, buttons:** Plus Jakarta Sans (Google Fonts, weights 400-800) — geometric humanist sans-serif with warm rounded personality
- **Headings / page titles:** Plus Jakarta Sans Bold (same family, weight 700+) — differentiated by weight, not by face
- **"Journada" wordmark only:** Cormorant Garamond SemiBold (italic variant sometimes used) — serif reserved exclusively for the brand wordmark, never for UI

### Why this split matters
Premium apps use *one family* for UI and reserve a *distinctive secondary face* for the wordmark/brand. Claude.ai does this: Copernicus serif for the wordmark, Styrene B sans for UI. Journada follows the same pattern.

### Sizing scale
- Wordmark: 20-48px Cormorant SemiBold
- Page titles: 24px Plus Jakarta Bold
- Section headings: 14-18px Plus Jakarta SemiBold
- Body: 14-16px Plus Jakarta Regular
- Labels/hints: 10-12px Plus Jakarta Medium, often uppercase with `tracking-widest`

### Letter-spacing
- Titles: `tracking-tight` (-0.02em)
- Section labels: `tracking-widest` (0.1em+) when uppercased
- Body: default

---

## 6. Motion & Physics

### Spring presets (from `lib/spring.ts`)
All motion should reference one of four presets so the UI feels made of the same physical material:
- **`SPRING.snappy`** (stiffness: 280, damping: 26, mass: 0.8) — toggles, chips
- **`SPRING.firm`** (170/22/1.0) — cards, section transitions, the app default
- **`SPRING.heavy`** (110/18/1.3) — modals, belt ceremonies, major transitions
- **`SPRING.gentle`** (70/12/1.0) — particles, ambient drifts

### Feel target
**Heavier than snappy, lighter than QuickBooks.** Elements have mass. When something moves, it settles with authority — not a sharp snap, not a lazy drift.

### Haptic feedback (Android via Vibration API)
- Tap: 8ms
- Toggle select: 8ms
- Resonance tick: 6ms
- Vertex snap (Prism): 12ms — strongest, for committed decisions

### Signature animations
- **Belt tying ceremony** — Belt slides in (500ms), knot crossing forms (300ms), tails drop with pendulum physics (480ms), champagne sparks rise
- **Seigaiha wave background** — Tiled Japanese wave pattern drifting at 12.2s loop
- **Streak sheen sweep** — Gold gradient sweeps across consecutive streak cells on the heatmap
- **Particle rises** — Champagne particles drift up from intention banners and milestone cards

---

## 7. Key UI Patterns

### Section cards
Any grouped form or content lives inside a `SURFACE_2` rounded-xl container with a 1px border at 5% white. Section label in uppercase tracking-widest at 10-12px sits inside the card at the top.

### Toggle groups (`SegmentedToggle`)
Unified across the entire app. Track: `SURFACE_2` background, 2px padding. Active segment: `COPPER` fill, white text. Inactive: transparent, 45% white text. 10px rounded corners, 40px tall.

### Primary CTAs
52px tall, brand orange (`#DA7422`), rounded-xl, subtle orange glow shadow. Used for: Log Session, Save, Set Focus. Only one primary CTA visible at a time.

### Intensity color-gradient bar
A 5-segment connected bar using the intensity scale colors. Active segment expands 4px taller, fills solid, shows dark text. This is the signature control — used for session intensity input and read-only display.

### The Grappling Prism
An interactive SVG pentagon for selecting training focus. 5 vertices representing skill pillars. User taps or drags to place a dot — closer to a vertex = higher "resonance" (focus score). Haptic feedback on snap. Concentric guide rings, radial gradient fill from active vertex. This is the core novel interaction of the app.

### The BeltBar
Persistent header element showing the user's current belt rank and stripes. Animated on mount (slide → knot → tail drop). Interactive tails that follow the cursor on hover, whip on click (easter egg).

---

## 8. Current Screens

### Home (`/home`) — "The Path Ahead"
Greeting + stat strip + weekly intention card + week view (7 circular day indicators) + primary CTA + Rep Roulette + heatmap preview. The weekly intention sits above everything, driving the user's attention back to *why* they're training this week.

### Calendar (`/calendar`) — "Mat Time"
Year heatmap in two modes: compact (GitHub-contribution style, 52 weeks on desktop) and detailed (full month grid). Click any day to log/edit a session.

### Analytics (`/analytics`)
Grappling Prism radar chart + time window filter + alignment timeline comparing stated intentions against actual training focus.

### Intentions (`/intentions`)
History of weekly focus declarations with alignment indicators. Click into any intention to write a journal entry for that week.

### Profile (`/profile`)
Settings, belt rank, gym, data import/export. Kept deliberately small (max-width 672px on desktop).

---

## 9. What Makes Journada Feel Different From Competitors

1. **It never shouts.** No push notification shame, no streak anxiety, no social comparison.
2. **It treats training like a craft, not a workout.** Intentions come *before* sessions. Reflection comes *after*.
3. **The Prism is a gesture, not a form.** Users express "what I trained" through spatial position, not dropdown menus.
4. **Time is respected.** The Eight Gates streak milestones (2, 4, 6, 8, 12, 16, 20, 26 weeks) honor long consistency over short bursts.
5. **Darkness is warmth.** The forest-green-plus-copper palette feels like a leather journal or a tatami room, not a tech product.

---

## 10. Open Design Questions

These are areas where the brand could evolve:

1. **Onboarding** — No onboarding currently exists. Need to design a first-run experience that sets up Focus Areas (the user's 1-5 chosen pillars) without feeling like form-filling.
2. **Page transitions** — Navigating between tabs is a hard cut. What would route-level motion that matches the "heavy spring" physics feel like?
3. **Celebration moments** — Logging a session currently shows a toast. What's the equivalent of a subtle, on-brand "well done" that matches the voice?
4. **Error and empty states** — Currently plain text. Could become branded illustrations or typographic moments.
5. **Sound design** — The app is silent. Should logging a session have a subtle audio cue? What would that sound like in this brand?

---

## 11. Reference Materials

For quick visual context, these apps/brands share aesthetic DNA with Journada:
- **Claude.ai** (warm cream + serif wordmark + restraint)
- **Oak Meditation app** (dark, minimal, literary)
- **Day One journaling** (writing-focused, paper-like)
- **The New Yorker app** (editorial restraint, strong typography)
- **Aesop** (apothecary, cream and olive palette, considered copy)

Apps to *avoid* emulating: Strava, Nike Training Club, Peloton, MyFitnessPal, Strong, Duolingo.

---

## 12. How to Use This Document

**For Claude / AI design tools:** Paste this entire file as context at the start of any design conversation. Reference specific sections ("Per section 5, typography uses..."). When proposing new screens, check against section 9 for brand fit.

**For human designers:** This is the canonical brand reference. Deviations should be intentional and discussed.

**For developers:** Design tokens in section 4 map to constants in `lib/theme.ts`. Motion in section 6 maps to `lib/spring.ts`. Voice in section 2 applies to all user-facing strings.
