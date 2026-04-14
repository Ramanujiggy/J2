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
    f.to !== null
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
    return true;
  });
}
