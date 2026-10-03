# BJJ API Research

Private research folder for exploring a standalone BJJ API / taxonomy service. Not tracked in J2's git history — this lives in `.gitignore`.

## What this is

Early-stage exploration of building a structured BJJ knowledge API that could eventually serve as infrastructure for Journada and other BJJ apps.

## Key resources

### Open data
- **GrappleMap** — [github.com/Eelis/GrappleMap](https://github.com/Eelis/GrappleMap) — 843 positions, 1,485 transitions, public domain. The only open structured position graph for BJJ.

### Closed platforms (competitive research)
- **OutlierDB** — [outlierdb.com](https://outlierdb.com/) — Match analysis + AI search. Closed platform, no public API. Good for understanding what match-level data looks like.
- **Graphling** — [Medium](https://medium.com/@Graphling/graphling-envisioning-the-future-of-bjj-through-deterministic-models-e29933a2891c) — Academic approach: BJJ as a state machine (positions = states, techniques = transitions).
- **SubmitSU** — [submitsu.com](https://www.submitsu.com/resources/training/technique-database) — Technique database guide.

## Journada's existing taxonomy assets
- `canonical_positions` table — curated position vocabulary with pillar classification
- `canonical_constraints` table — training rule modifications
- `user_tags` table — user's personal technique library
- Pillar system: standup, passing, pins, submissions, guard
- Analytics models: ACWR, decay/retention, pillar distribution

## API tier concept
1. **Vocabulary (free)** — canonical positions, techniques, transitions graph. Adoption driver.
2. **Session data (paid)** — structured training log format any app can adopt. Import/export.
3. **Intelligence (paid)** — gap analysis, curriculum suggestions, training load models.
4. **Community (future)** — match results, competitor profiles, gym directory.

## Next steps
- [ ] Pull GrappleMap dataset and analyze its position/transition schema
- [ ] Map GrappleMap positions to Journada's pillar system
- [ ] Design the REST API schema (v1 endpoints)
- [ ] Determine: separate repo or monorepo subfolder?
