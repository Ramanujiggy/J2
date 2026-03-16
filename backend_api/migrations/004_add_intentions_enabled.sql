-- Migration 004: Intentions feature toggle per user
-- Run in Supabase SQL editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intentions_enabled BOOLEAN NOT NULL DEFAULT TRUE;
