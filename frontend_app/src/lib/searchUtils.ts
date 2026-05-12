import type { SessionSummary } from '../types/api.ts';

export interface SearchFilters {
  q: string;
  gi_nogi: 'gi' | 'no_gi' | null;
  session_type: 'class' | 'drilling' | 'competition_training' | null;
  heading: string | null;
  intensity_min: number;
  intensity_max: number;
  from: string | null;
  to: string | null;
  /** Freetext partner name. Matches case-insensitively against any element of `partners`. */
  partner: string;
  /** Constraint IDs (canonical or user-scoped). A session matches if its
   *  canonical_constraint_ids OR user_constraint_ids contains any of these. */
  constraint_ids: string[];
}

export const DEFAULT_FILTERS: SearchFilters = {
  q: '',
  gi_nogi: null,
  session_type: null,
  heading: null,
  intensity_min: 1,
  intensity_max: 5,
  from: null,
  to: null,
  partner: '',
  constraint_ids: [],
};

export function hasActiveFilters(f: SearchFilters): boolean {
  return (
    f.q !== '' ||
    f.gi_nogi !== null ||
    f.session_type !== null ||
    f.heading !== null ||
    f.intensity_min > 1 ||
    f.intensity_max < 5 ||
    f.from !== null ||
    f.to !== null ||
    f.partner !== '' ||
    f.constraint_ids.length > 0
  );
}

export function filterSessionsLocal(
  sessions: SessionSummary[],
  filters: SearchFilters,
): SessionSummary[] {
  return sessions.filter(s => {
    if (filters.q) {
      const q = filters.q.toLowerCase();
      const inNotes = s.notes?.toLowerCase().includes(q);
      const inSub = s.sub_skill_tag?.toLowerCase().includes(q);
      const inHeading = s.heading?.toLowerCase().includes(q);
      if (!inNotes && !inSub && !inHeading) return false;
    }
    if (filters.gi_nogi && s.gi_nogi !== filters.gi_nogi) return false;
    if (filters.session_type && s.session_type !== filters.session_type) return false;
    if (filters.heading && s.heading !== filters.heading) return false;
    if (s.intensity < filters.intensity_min || s.intensity > filters.intensity_max) return false;
    if (filters.from && s.date < filters.from) return false;
    if (filters.to && s.date > filters.to) return false;
    if (filters.partner) {
      const needle = filters.partner.toLowerCase();
      const partners = s.partners ?? [];
      if (!partners.some(p => p.toLowerCase().includes(needle))) return false;
    }
    if (filters.constraint_ids.length > 0) {
      const ids = new Set([...(s.canonical_constraint_ids ?? []), ...(s.user_constraint_ids ?? [])]);
      if (!filters.constraint_ids.some(id => ids.has(id))) return false;
    }
    return true;
  });
}
