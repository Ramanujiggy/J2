-- 011: Remove the uppercase 'White' DEFAULT from users.belt_rank.
--
-- The column was originally created manually on Supabase with a DEFAULT of
-- 'White' (capitalized). Migration 006 later added:
--   CHECK (belt_rank IS NULL OR belt_rank IN ('white','blue','purple','brown','black'))
-- plus a one-time LOWER() on existing rows. But it did not update the column
-- default, so every new registration still inserts the uppercase default and
-- fails the check constraint. createUser in userModel.ts only inserts
-- (email, password_hash), so the column default is what lands in the row.
--
-- Fix: drop the default. The column is nullable and the UI treats null as
-- "White" via its existing fallback (beltRank ?? 'White'), so users see no
-- change; new registrations just insert NULL and pass the constraint.

ALTER TABLE users ALTER COLUMN belt_rank DROP DEFAULT;
