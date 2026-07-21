// computeEras — group consecutive same-heading intention weeks into "eras."
//
// Walk newest-first; group consecutive same-heading weeks where the older
// week_start is exactly one duration before the run's current oldest week.
// Headless intentions break a run.
//
// Used by both desktop and mobile branches of IntentionsPage. Pure function;
// no React, no state.
//
// Extracted from IntentionsPage.tsx during the 2026-05-09 refactor pass.

import type { Intention, Pillar } from '../../types/api.ts';
import { addDays } from '../../lib/sessionUtils.ts';
import { ALL_PILLARS, type Era } from './intentionsTypes.ts';

export function computeEras(intentions: Intention[]): Era[] {
  if (intentions.length === 0) return [];
  // Sort newest-first
  const ordered = [...intentions].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const out: Era[] = [];
  let run: Era | null = null;

  for (const i of ordered) {
    const heading = i.heading as Pillar | null;
    if (!heading || !(ALL_PILLARS as string[]).includes(heading)) {
      // Skip headless intentions — they don't belong in an era.
      if (run) { out.push(run); run = null; }
      continue;
    }
    if (run && run.focus === heading) {
      // Two intentions are "consecutive" if the older one's week_start +
      // its duration === the run's current oldest week_start.
      const oldestStart = run.lastWk;
      const candidateExpectedNext = addDays(i.week_start.slice(0, 10), i.duration_days ?? 7);
      if (candidateExpectedNext === oldestStart) {
        run.weeks.push(i);
        run.lastWk = i.week_start.slice(0, 10);
        continue;
      }
    }
    // Start a new run
    if (run) out.push(run);
    run = {
      focus: heading,
      weeks: [i],
      firstWk: i.week_start.slice(0, 10),
      lastWk: i.week_start.slice(0, 10),
    };
  }
  if (run) out.push(run);
  return out;
}
