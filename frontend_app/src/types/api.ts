// ── Domain types ──────────────────────────────────────────────────────────

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

/** Map of pillar → weight in [0, 1]. Weights sum to ~1.0 (server renormalizes). */
export type PillarDistribution = Partial<Record<Pillar, number>>;

// `competition_training` is preserved as a legacy value; new sessions use
// `class | drilling | cla` (Constraints-Led Approach).
export type SessionType = 'class' | 'drilling' | 'competition_training' | 'cla';

export interface SessionSummary {
  id: string;
  date: string;
  duration: number;
  intensity: number;
  gi_nogi: 'gi' | 'no_gi';
  session_type: SessionType;
  notes?: string;
  tags: string[];
  // Dynamic Pillar Engine fields (nullable — older sessions won't have them)
  heading?: string | null;
  polarity?: 'offense' | 'defense' | 'neutral' | null;
  sub_skill_tag?: string | null;
  script_source?: 'directed' | 'organic' | null;
  resonance?: number | null;
  user_tag_ids?: string[] | null;
  canonical_position_ids?: string[] | null;
  pillar_distribution?: PillarDistribution | null;
  // migration 014 — pillars that carried the long-press deep_work flag.
  // Lets sessionToSelections rehydrate halo rings on re-open. Null on legacy rows.
  deep_work_pillars?: Pillar[] | null;
  // migration 013 — input telemetry. Null on rows that predate the chip flow.
  had_primary?: boolean | null;
  had_deep_work?: boolean | null;
  selection_count?: number | null;
  // migration 015 — constraint linkage for CLA sessions. Null on non-CLA rows.
  canonical_constraint_ids?: string[] | null;
  user_constraint_ids?: string[] | null;
  // migration 016 — freetext partner names. Will grow to user_partners refs
  // in the Journada 2.0 social layer.
  partners?: string[] | null;
}

export interface UserTag {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: Pillar;
  aliases?: string[];                    // migration 012 — user-owned aliases for typeahead
  created_at: string;
  // Move Library (migration 010) — video lives client-side; only metadata syncs
  has_video?: boolean;
  video_thumbnail?: string | null;
  video_duration_seconds?: number | null;
  video_notes?: string | null;
}

export interface CanonicalPosition {
  id: string;
  name: string;
  parent_pillar: Pillar;
  aliases: string[];
  created_at: string;
}

export interface CanonicalPositionsResponse {
  positions: CanonicalPosition[];
}

// migration 015 — Constraints library. Mirrors the canonical_positions /
// user_tags pair for "rule modifications" the user trains under during a
// CLA session (e.g., "only attack from closed guard"). Optional parent_pillar
// because some constraints span multiple pillars (e.g., "no grips").
export interface CanonicalConstraint {
  id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  description?: string | null;
  created_at: string;
}

export interface UserConstraint {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  created_at: string;
}

export interface CanonicalConstraintsResponse {
  constraints: CanonicalConstraint[];
}

export interface UserConstraintsResponse {
  constraints: UserConstraint[];
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
