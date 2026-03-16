-- Migration 003: Add journal_entry column to weekly_intentions
-- Run in Supabase SQL editor

ALTER TABLE weekly_intentions
  ADD COLUMN IF NOT EXISTS journal_entry TEXT;
