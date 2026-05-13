CREATE TABLE IF NOT EXISTS training_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text              TEXT NOT NULL,
  tags              TEXT[] DEFAULT '{}',
  linked_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  pinned            BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_notes_user ON training_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_training_notes_search ON training_notes USING gin(to_tsvector('english', text));
