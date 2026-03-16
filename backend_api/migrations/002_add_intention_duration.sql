-- Migration 002: Intention Duration
-- Run this in Supabase's SQL editor.

-- Add duration_days to weekly_intentions.
-- Existing rows default to 7 (one full week — preserves prior behaviour).
ALTER TABLE weekly_intentions
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 7
  CHECK (duration_days BETWEEN 1 AND 30);
