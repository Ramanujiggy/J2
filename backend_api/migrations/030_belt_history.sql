CREATE TABLE IF NOT EXISTS belt_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  belt_rank   VARCHAR(50) NOT NULL CHECK (belt_rank IN ('white','blue','purple','brown','black')),
  stripes     INTEGER NOT NULL DEFAULT 0 CHECK (stripes >= 0 AND stripes <= 4),
  promoted_at DATE NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_belt_history_user ON belt_history(user_id);
CREATE INDEX IF NOT EXISTS idx_belt_history_date ON belt_history(user_id, promoted_at);
