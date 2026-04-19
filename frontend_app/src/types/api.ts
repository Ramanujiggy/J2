// ── Domain types ──────────────────────────────────────────────────────────

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

/** Map of pillar → weight in [0, 1]. Weights sum to ~1.0 (server renormalizes). */
export type PillarDistribution = Partial<Record<Pillar, number>>;

export interface SessionSummary {
  id: string;
  date: string;
  duration: number;
  intensity: number;
  gi_nogi: 'gi' | 'no_gi';
  session_type: 'class' | 'drilling' | 'competition_training';
  notes?: string;
  tags: string[];
  // Dynamic Pillar Engine fields (nullable — older sessions won't have them)
  heading?: string | null;
  polarity?: 'offense' | 'defense' | 'neutral' | null;
  sub_skill_tag?: string | null;
  script_source?: 'directed' | 'organic' | null;
  resonance?: number | null;
  user_tag_ids?: string[] | null;
  pillar_distribution?: PillarDistribution | null;
}

export interface UserTag {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: Pillar;
  created_at: string;
  // Move Library (migration 010) — video lives client-side; only metadata syncs
  has_video?: boolean;
  video_thumbnail?: string | null;
  video_duration_seconds?: number | null;
  video_notes?: string | null;
}

export interface UserTagVideoUpdate {
  has_video?: boolean;
  video_thumbnail?: string | null;
  video_duration_seconds?: number | null;
  video_notes?: string | null;
}

export interface UserTagsResponse {
  tags: UserTag[];
}

export interface Intention {
  id: string;
  user_id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  heading: string | null;
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

export interface SearchSessionsResponse {
  sessions: SessionSummary[];
  total: number;
}

export interface ProfileResponse {
  profile: { name: string | null; belt_rank: string | null; stripes: number; intentions_enabled: boolean } | null;
}
