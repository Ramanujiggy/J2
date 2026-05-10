-- 029: class_attendance table
--
-- Backs TodayCard's pre/post-class Yes/No prompts. Replaces the per-device
-- localStorage flags (`attendance.{scheduleId}.{date}.planning|attended`)
-- with a server-side row per (user, schedule, date), so:
--   • answers sync across devices ("Yes I'll attend" on phone → desktop sees it)
--   • answers survive browser-data clears, private browsing, app uninstall
--   • we can analytics-query planned-vs-actual attendance ratios
--
-- Shape:
--   • `planning` is the pre-class answer ("Planning to attend?" → yes/no)
--   • `attended` is the post-class answer ("Did you attend?" → yes/no)
--   • Either flag may be NULL (= not yet answered, or user explicitly cleared)
--   • Row exists when the user has answered *at least one* of the two flags
--
-- UPSERT pattern: client never specifies which flag triggers a row creation;
-- the controller's PUT handler does ON CONFLICT DO UPDATE keyed on the
-- UNIQUE (user_id, schedule_id, date) triple.
--
-- FK choices:
--   • user_id  → ON DELETE CASCADE — same as every other user-owned table
--   • schedule_id → ON DELETE CASCADE — if the schedule is deleted, the
--     attendance history loses meaning (the class no longer exists)

CREATE TABLE IF NOT EXISTS class_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id)           ON DELETE CASCADE,
  schedule_id UUID NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  planning    TEXT NULL,
  attended    TEXT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT class_attendance_planning_chk
    CHECK (planning IS NULL OR planning IN ('yes', 'no')),
  CONSTRAINT class_attendance_attended_chk
    CHECK (attended IS NULL OR attended IN ('yes', 'no')),

  -- One row per (user, class instance). The PUT handler relies on this
  -- for ON CONFLICT semantics; the import endpoint relies on it for
  -- idempotent re-runs across devices.
  CONSTRAINT class_attendance_user_schedule_date_uq
    UNIQUE (user_id, schedule_id, date)
);

-- Hot query: "what's this user's attendance for today ± 7d?" (TodayCard's
-- mount fetch). user_id selects the rows; date DESC keeps the most-recent
-- instances at the front of the index for range scans.
CREATE INDEX IF NOT EXISTS class_attendance_user_date_idx
  ON class_attendance (user_id, date DESC);
