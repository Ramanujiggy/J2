-- 000: Create core tables (users + training_sessions).
-- These were originally created manually on Supabase. This migration
-- ensures a fresh database (e.g. Railway Postgres) gets the base schema.

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    belt_rank       VARCHAR(50),
    stripes         INTEGER DEFAULT 0,
    home_gym_name   VARCHAR(255),
    home_gym_address TEXT,
    home_gym_place_id VARCHAR(255),
    intentions_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    duration        INTEGER NOT NULL,
    gi_nogi         VARCHAR(10) NOT NULL,
    intensity       INTEGER NOT NULL,
    session_type    VARCHAR(50) NOT NULL,
    notes           TEXT,
    tags            TEXT[] NOT NULL DEFAULT '{}',
    heading         VARCHAR(20),
    polarity        VARCHAR(10),
    sub_skill_tag   TEXT,
    script_source   VARCHAR(10),
    resonance       INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date
    ON training_sessions (user_id, date DESC);
