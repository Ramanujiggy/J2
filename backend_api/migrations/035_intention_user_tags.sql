-- 035_intention_user_tags.sql
--
-- Associates techniques (user_tags) with intentions. An intention can
-- optionally reference user_tag UUIDs to declare which specific
-- techniques the user intends to work on during the intention window.
--
-- Purely additive — existing rows get NULL (no linked techniques).

ALTER TABLE weekly_intentions
    ADD COLUMN IF NOT EXISTS user_tag_ids UUID[] DEFAULT NULL;
