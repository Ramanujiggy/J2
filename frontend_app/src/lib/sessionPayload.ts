// sessionPayload — the single source of truth for turning a session draft into
// the /api/sessions request body.
//
// The create form (LogSessionForm), the Capture Composer, and the future Margin
// Notes entry each hand-assembled this same field list separately and had
// already drifted (composer hardcodes polarity/constraints, edit drops
// partners). This function centralizes the derivation so every surface produces
// an identical, correct row. Derived fields (tags, heading, distribution, the
// mig-013/014 telemetry) are computed here from `selections`, never by callers.

import { selectionsToDistribution, type ChipSelection } from './selectionsToDistribution.ts';
import type { Pillar, PillarDistribution } from '../types/api.ts';

export interface SessionDraft {
  date: string;
  duration: number;
  notes: string;
  gi_nogi: 'gi' | 'no_gi' | 'both';
  intensity: number;
  session_type: string;
  selections: ChipSelection[];
  polarity?: string | null;
  sub_skill_tag?: string;
  script_source?: string | null;
  resonance?: number | null;
  user_tag_ids?: string[];
  canonical_position_ids?: string[];
  canonical_constraint_ids?: string[];
  user_constraint_ids?: string[];
  partners?: string[];
}

export interface SessionPayload {
  date: string;
  duration: number;
  notes: string;
  gi_nogi: string;
  intensity: number;
  session_type: string;
  tags: Pillar[];
  heading: Pillar | null;
  polarity?: string;
  sub_skill_tag?: string;
  script_source?: string;
  resonance?: number | null;
  user_tag_ids?: string[];
  canonical_position_ids?: string[];
  pillar_distribution?: PillarDistribution;
  had_primary: boolean;
  had_deep_work: boolean;
  selection_count: number;
  deep_work_pillars: Pillar[];
  canonical_constraint_ids?: string[];
  user_constraint_ids?: string[];
  partners?: string[];
}

const nonEmpty = <T>(arr: T[] | undefined): T[] | undefined =>
  arr && arr.length > 0 ? arr : undefined;

export function buildSessionPayload(draft: SessionDraft): SessionPayload {
  const { selections } = draft;
  const tags = Array.from(new Set(selections.map(s => s.pillar)));
  const heading = selections.find(s => s.primary)?.pillar ?? null;
  const distribution = selectionsToDistribution(selections);

  return {
    date: draft.date,
    duration: draft.duration,
    notes: draft.notes,
    gi_nogi: draft.gi_nogi,
    intensity: draft.intensity,
    session_type: draft.session_type,
    tags,
    heading,
    polarity: draft.polarity ?? undefined,
    sub_skill_tag: draft.sub_skill_tag || undefined,
    script_source: draft.script_source ?? undefined,
    // Passthrough — retired as an input but preserved on edit so it isn't nulled.
    resonance: draft.resonance ?? undefined,
    user_tag_ids: nonEmpty(draft.user_tag_ids),
    canonical_position_ids: nonEmpty(draft.canonical_position_ids),
    pillar_distribution: distribution ?? undefined,
    // Migration 013 telemetry — adoption signal for primary + deep-work.
    had_primary: selections.some(s => s.primary),
    had_deep_work: selections.some(s => s.deep_work),
    selection_count: selections.length,
    // Migration 014 — per-pillar deep_work set so the saved Prism shape
    // rehydrates with halo rings on reopen.
    deep_work_pillars: selections.filter(s => s.deep_work).map(s => s.pillar),
    canonical_constraint_ids: nonEmpty(draft.canonical_constraint_ids),
    user_constraint_ids: nonEmpty(draft.user_constraint_ids),
    partners: nonEmpty(draft.partners),
  };
}
