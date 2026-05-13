ALTER TABLE training_notes ADD COLUMN IF NOT EXISTS linked_tag_ids UUID[] DEFAULT '{}';
