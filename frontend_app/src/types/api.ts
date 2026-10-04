// ── Domain types ──────────────────────────────────────────────────────────

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

/** Map of pillar → weight in [0, 1]. Weights sum to ~1.0 (server renormalizes). */
export type PillarDistribution = Partial<Record<Pillar, number>>;

// `competition_training` is preserved as a legacy value; new sessions use
// `class | drilling | cla` (Constraints-Led Approach).
export type SessionType = 'class' | 'drilling' | 'competition_training' | 'cla';
export type GiNoGi = 'gi' | 'no_gi' | 'both';

export interface SessionSummary {
  id: string;
  date: string;
  duration: number;
  intensity: number;
  gi_nogi: 'gi' | 'no_gi' | 'both';
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
  // migration 037 — stamps struck on this session (Boa, future dies).
  stamps?: { die_key: string; struck_at: string }[];
}

export type Affinity = 'go_to' | 'learning' | 'shelved';
export type VideoStatus = 'processing' | 'ready' | 'failed';

export interface UserTag {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: Pillar;
  aliases?: string[];                    // migration 012 — user-owned aliases for typeahead
  created_at: string;
  // Move Library (migration 010) — thumbnail + metadata sync; bytes lived in
  // OPFS pre-mig-028, now live in R2 (OPFS becomes a cache).
  has_video?: boolean;
  video_thumbnail?: string | null;
  video_duration_seconds?: number | null;
  video_notes?: string | null;
  // Technique Library v1 (migration 027) — personal judgement + memory book
  affinity?: Affinity | null;
  resonance_journal?: string | null;
  // Move Library v2 (migration 028) — cloud storage + transcoding
  video_status?: VideoStatus | null;
  video_storage_key?: string | null;
  video_byte_size?: number | null;
  video_status_message?: string | null;
}

// ── Session videos + position segments (migration 040) ────────────────────

export interface SessionVideo {
  id: string;
  session_id: string;
  user_id: string;
  created_at: string;
  video_status: VideoStatus | null;
  video_storage_key: string | null;
  video_byte_size: number | null;
  video_status_message: string | null;
  video_thumbnail: string | null;
  video_duration_seconds: number | null;
  video_notes: string | null;
}

export interface PositionSegment {
  id: string;
  video_id: string;
  user_id: string;
  start_sec: number;
  end_sec: number;
  position_label: string;
  source: 'manual' | 'model';
  confirmed: boolean;
  created_at: string;
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

// migration 017 — rich game metadata. Captures the pedagogical structure
// of a CLA game: family, role taxonomy, goals per side, cues, etc. JSONB
// in the DB; optional everywhere so older rows without details still work.
//
// The `your_role` taxonomy is BJJ-specific and intentionally distinguishes
// the two flavors of "bottom":
//   - guard_player    — on your back with legs between you and them
//                       (offense from below; closed/open/half guard)
//   - pin_escaper     — they're past your legs (recovery from a dominant pin)
// "Bottom" alone is ambiguous; these two roles are different problems.
export type ConstraintRole =
  | 'guard_player'
  | 'pin_escaper'
  | 'top_passer'
  | 'pin_holder'
  | 'back_attacker'
  | 'back_escaper'
  | 'turtle_attacker'
  | 'turtle_defender'
  | 'standing';

export interface ConstraintDetails {
  family?: string;
  full_label?: string;
  your_role?: ConstraintRole;
  start_position?: string;
  continuous_goals?: { top?: string; bottom?: string };
  terminal_goals?:  { top?: string; bottom?: string };
  reset_condition?: string;
  difficulty?: 'low' | 'medium' | 'high' | 'mixed';
  recommended_level?: string;
  duration_minutes?: number;
  cues?: string[];
  metrics?: string[];
  common_errors?: string;
  safety_notes?: string;
  progression?: string;
  regression?: string;
  source?: string;
  roulette_eligible?: boolean;
}

export interface CanonicalConstraint {
  id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  description?: string | null;
  details?: ConstraintDetails | null;
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

export type IntentionCompletionType = 'days' | 'sessions' | 'training_weeks';

export interface Intention {
  id: string;
  user_id: string;
  week_start: string;
  intent_label: string;
  intent_category: string | null;
  heading: string | null;
  duration_days: number;
  /**
   * Completion mode (mig 034). Determines what "active" / "complete" mean:
   *   • 'days'           — wall-clock; ends after duration_days elapse
   *   • 'sessions'       — ends once target_count sessions touching heading
   *                        have been logged since week_start
   *   • 'training_weeks' — ends once target_count distinct ISO weeks
   *                        containing >= 1 session have elapsed
   * For non-'days' modes, duration_days is a soft calendar ceiling.
   */
  completion_type: IntentionCompletionType;
  target_count: number | null;
  user_tag_ids?: string[] | null;
  journal_entry: string | null;
  created_at: string;
}

export type CalendarIntention = Pick<Intention,
  'id' | 'week_start' | 'intent_label' | 'intent_category' | 'duration_days' | 'heading'>;

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
  profile: {
    name: string | null;
    belt_rank: string | null;
    stripes: number;
    intentions_enabled: boolean;
    // migration 019 — IANA TZ ("America/Chicago") set via PATCH /api/profile/timezone.
    // Nullable for legacy rows that predate the migration.
    timezone?: string | null;
    // migration 022 — NULL = user hasn't completed first-time onboarding.
    // Frontend gates routing on this; POST /api/profile/onboarding-complete sets it.
    onboarding_completed_at?: string | null;
    // migration 023 — admin flag. Granted via direct DB UPDATE; not editable
    // via API. Drives the conditional "Admin Dashboard" link on the profile
    // page and the route guard on /admin.
    is_admin?: boolean;
    // migration 026 — onboarding funnel step (0..5). Highest step the user
    // has reached in the guided onboarding flow. Captured for drop-off
    // observability via PATCH /api/profile/onboarding-step.
    onboarding_step?: number;
  } | null;
}

// ── Support cases + admin dashboard (mig 023) ────────────────────────────

export type CaseStatus   = 'open' | 'in_progress' | 'closed';
export type CaseSeverity = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportCase {
  id: string;
  user_id: string;
  status: CaseStatus;
  severity: CaseSeverity;
  subject: string;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

// Admin's case list joins on users → email + name come along for free.
export interface SupportCaseWithUser extends SupportCase {
  user_email: string;
  user_name: string | null;
}

export interface AdminStats {
  total_users: number;
  users_24h: number;
  users_7d: number;
  // Test-user counts (emails matching @journada-e2e.com or @example.com).
  // Frontend subtracts these from displayed totals when "Show test users"
  // is off. Added in the admin dashboard polish pass alongside mig 025.
  test_user_count: number;
  test_users_24h: number;
  test_users_7d: number;
  total_sessions: number;
  sessions_24h: number;
  sessions_7d: number;
  cases_open: number;
  cases_in_progress: number;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  belt_rank: string | null;
  created_at: string;
  session_count: number;
  last_session_at: string | null;
}

export interface AdminStatsResponse  { stats: AdminStats; }
export interface AdminCasesResponse  { cases: SupportCaseWithUser[]; }
export interface AdminUsersResponse  { users: AdminUserSummary[]; }
export interface SubmitCaseResponse  { case: SupportCase; }
export interface UpdateCaseResponse  { case: SupportCase; }

// ── Admin user detail ────────────────────────────────────────────────────
// Backs /admin/users/:id — single round-trip with profile + activity stats
// + recent sessions + intentions + cases. Read-only in v1.

export interface AdminUserProfile {
  id: string;
  email: string;
  name: string | null;
  belt_rank: string | null;
  stripes: number;
  home_gym_name: string | null;
  home_gym_address: string | null;
  timezone: string | null;
  intentions_enabled: boolean;
  is_admin: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminUserActivityStats {
  total_sessions: number;
  total_minutes: number;
  last_session_at: string | null;
  sessions_7d: number;
}

// Subset of SessionSummary that the detail endpoint returns — keep it
// loose since the admin view doesn't need every column.
export interface AdminUserSession {
  id: string;
  date: string;
  duration: number;
  intensity: number;
  gi_nogi: 'gi' | 'no_gi' | 'both';
  session_type: SessionType;
  heading: string | null;
  notes: string | null;
}

export interface AdminUserIntention {
  id: string;
  week_start: string;
  intent_label: string;
  heading: string | null;
  duration_days: number;
  journal_entry: string | null;
  created_at: string;
}

export interface AdminUserDetailResponse {
  user: AdminUserProfile;
  stats: AdminUserActivityStats;
  recent_sessions:   AdminUserSession[];
  recent_intentions: AdminUserIntention[];
  cases:             SupportCase[];
}

// ── Admin app structure ───────────────────────────────────────────────────

export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileTreeResponse {
  root: string;
  tree: FileTreeNode[];
}

export interface RouteEntry {
  method: string;
  path: string;
}

export interface RoutesResponse {
  routes: RouteEntry[];
}

// ── Class schedules + push notifications (mig 019/020/021) ──────────────────

export interface ClassSchedule {
  id: string;
  user_id: string;
  name: string;
  day_of_week: number;            // 0=Sun … 6=Sat
  start_time: string;             // 'HH:MM:SS'
  duration_min: number;
  gi_nogi: 'gi' | 'no_gi' | 'both' | null;
  is_active: boolean;
  created_at: string;
}

export interface ClassSchedulesResponse {
  schedules: ClassSchedule[];
}

export interface ClassScheduleResponse {
  schedule: ClassSchedule;
}

export interface ClassScheduleInput {
  name: string;
  day_of_week: number;
  start_time: string;
  duration_min: number;
  gi_nogi: 'gi' | 'no_gi' | 'both' | null;
}

export interface BeltHistoryEntry {
  id: string;
  belt_rank: string;
  stripes: number;
  promoted_at: string;
  notes: string | null;
  /** The training entry logged the same day, when there is one (mig 039). */
  session_id?: string | null;
}

export interface BeltHistoryResponse {
  belt_history: BeltHistoryEntry[];
}

// Aggregated per-die stamp record (one entry per die the user has struck).
// `count` drives the reveal sheet's "Nth time"; first/last are ISO timestamps.
export interface EarnedStamp {
  die_key: string;
  count: number;
  first_struck_at: string;
  last_struck_at: string;
}

export interface StampsResponse {
  stamps: EarnedStamp[];
}

export interface TrainingNote {
  id: string;
  text: string;
  tags: string[];
  linked_session_id: string | null;
  linked_tag_ids: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingNotesResponse {
  notes: TrainingNote[];
}
