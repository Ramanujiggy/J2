// ── Domain types ──────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  date: string;
  duration: number;
  intensity: number;
  gi_nogi: 'gi' | 'no_gi';
  session_type: 'class' | 'drilling' | 'competition_training';
  notes?: string;
  tags: string[];
}

export interface Intention {
  id: string;
  user_id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  duration_days: number;
  journal_entry: string | null;
  created_at: string;
}

export type CalendarIntention = Pick<Intention,
  'id' | 'week_start' | 'intent_label' | 'intent_category' | 'duration_days'>;

// ── API response wrappers ─────────────────────────────────────────────────

export interface SessionsResponse {
  sessions: SessionSummary[];
}

export interface IntentionsResponse {
  intentions: Intention[];
}

export interface ProfileResponse {
  profile: { belt_rank: string | null; stripes: number; intentions_enabled: boolean } | null;
}
