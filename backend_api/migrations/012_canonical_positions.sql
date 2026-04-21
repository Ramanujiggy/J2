-- 012: Canonical position library
--
-- Introduces a shared, curated vocabulary of BJJ positions that every user
-- searches against first. Custom positions still live in user_tags (per-user
-- private library). Sessions can reference both libraries via two separate
-- UUID arrays.
--
-- Why this exists: users were typing the same position different ways on
-- different days ("De La Riva" vs "DLR"), creating fragmented tag rows that
-- couldn't be aggregated for analytics. The canonical library centralises
-- the naming + aliases so autocomplete and alias matching collapse variants
-- to a single canonical row.

-- ── Canonical library table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canonical_positions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  parent_pillar   VARCHAR(20) NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canonical_positions_pillar_valid
    CHECK (parent_pillar IN ('standup', 'passing', 'pins', 'submissions', 'guard')),
  CONSTRAINT canonical_positions_name_length
    CHECK (length(name) BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS idx_canonical_positions_pillar
  ON canonical_positions(parent_pillar);

-- ── user_tags gains aliases for parity ─────────────────────────────────────
-- Users can later alias their own customs ("my worm variation", "the thing
-- Mav showed me") so TagPicker search can match on them too.
ALTER TABLE user_tags
  ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}';

-- ── training_sessions gains a second linkage array ─────────────────────────
-- Sessions now reference:
--   user_tag_ids            — per-user custom vocabulary (existing, from 008)
--   canonical_position_ids  — shared canonical library (new)
-- Either or both may be populated per session.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS canonical_position_ids UUID[] DEFAULT NULL;

-- ── Seed: 60 canonical positions ───────────────────────────────────────────
-- Idempotent via ON CONFLICT (name) DO NOTHING. Safe to re-run.

INSERT INTO canonical_positions (name, parent_pillar, aliases) VALUES
  -- Guard (18)
  ('Closed Guard',         'guard', ARRAY['full guard', 'closed']),
  ('Open Guard',           'guard', ARRAY['open']),
  ('Half Guard',           'guard', ARRAY['half']),
  ('Deep Half Guard',      'guard', ARRAY['deep half']),
  ('Z-Guard',              'guard', ARRAY['knee shield', 'z guard', 'knee-shield']),
  ('Butterfly Guard',      'guard', ARRAY['butterfly', 'hooks guard']),
  ('De La Riva',           'guard', ARRAY['DLR', 'de la hiva', 'dlr guard']),
  ('Reverse De La Riva',   'guard', ARRAY['RDLR', 'reverse dlr']),
  ('Lasso Guard',          'guard', ARRAY['lasso', 'single lasso', 'double lasso']),
  ('Spider Guard',         'guard', ARRAY['spider']),
  ('X-Guard',              'guard', ARRAY['x guard', 'full x']),
  ('Single Leg X',         'guard', ARRAY['SLX', 'ashi garami', 'single x']),
  ('50/50 Guard',          'guard', ARRAY['50/50', 'fifty-fifty']),
  ('Rubber Guard',         'guard', ARRAY['rubber']),
  ('Worm Guard',           'guard', ARRAY['worm']),
  ('K-Guard',              'guard', ARRAY['k guard']),
  ('Seated Guard',         'guard', ARRAY['seated', 'seated open']),
  ('Octopus Guard',        'guard', ARRAY['octopus']),

  -- Passing (10)
  ('Torreando',            'passing', ARRAY['bullfighter', 'torreado', 'toreando']),
  ('Knee Slice',           'passing', ARRAY['knee cut', 'knee slide']),
  ('Over-Under Pass',      'passing', ARRAY['over under', 'over/under', 'OU pass']),
  ('Double Under',         'passing', ARRAY['double unders', 'stack pass', 'stack']),
  ('Leg Drag',             'passing', ARRAY['leg-drag']),
  ('Long Step',            'passing', ARRAY['long step pass']),
  ('Smash Pass',           'passing', ARRAY['smash']),
  ('X-Pass',               'passing', ARRAY['x pass']),
  ('Headquarters',         'passing', ARRAY['HQ', 'headquarters pass']),
  ('Body Lock Pass',       'passing', ARRAY['bodylock pass', 'body-lock']),

  -- Pins (7)
  ('Side Control',         'pins', ARRAY['side', 'cross side']),
  ('Mount',                'pins', ARRAY['full mount']),
  ('Knee on Belly',        'pins', ARRAY['KoB', 'knee on stomach', 'knee-on-belly']),
  ('North-South',          'pins', ARRAY['north south', 'N/S', 'n-s']),
  ('Back Control',         'pins', ARRAY['back mount', 'on the back', 'back']),
  ('Turtle Top',           'pins', ARRAY['turtle', 'riding turtle']),
  ('Technical Mount',      'pins', ARRAY['tech mount', 's-mount', 's mount']),

  -- Submissions (15)
  ('Rear Naked Choke',     'submissions', ARRAY['RNC', 'rear naked']),
  ('Bow and Arrow Choke',  'submissions', ARRAY['bow and arrow', 'bow & arrow']),
  ('Triangle Choke',       'submissions', ARRAY['triangle']),
  ('Armbar',               'submissions', ARRAY['arm bar', 'juji gatame', 'juji']),
  ('Kimura',               'submissions', ARRAY['kimura lock', 'ude garami']),
  ('Americana',            'submissions', ARRAY['keylock', 'key lock', 'americana lock']),
  ('Omoplata',             'submissions', ARRAY['omo', 'omo-plata']),
  ('Straight Ankle Lock',  'submissions', ARRAY['ankle lock', 'SAL', 'straight foot lock']),
  ('Heel Hook',            'submissions', ARRAY['heel', 'inside heel hook', 'IHH', 'outside heel hook']),
  ('Kneebar',              'submissions', ARRAY['knee bar']),
  ('Toe Hold',             'submissions', ARRAY['toehold', 'toe-hold']),
  ('D''Arce Choke',        'submissions', ARRAY['darce', 'd''arce', 'brabo']),
  ('Anaconda Choke',       'submissions', ARRAY['anaconda']),
  ('Guillotine',           'submissions', ARRAY['guillotine choke', 'front choke']),
  ('Cross Collar Choke',   'submissions', ARRAY['cross collar', 'lapel choke', 'collar choke']),

  -- Stand-up (10)
  ('Double Leg Takedown',  'standup', ARRAY['double leg', 'double', 'DL']),
  ('Single Leg Takedown',  'standup', ARRAY['single leg', 'single', 'SL']),
  ('Arm Drag',             'standup', ARRAY['armdrag', 'arm-drag']),
  ('Seoi Nage',            'standup', ARRAY['shoulder throw', 'seoi']),
  ('Osoto Gari',           'standup', ARRAY['osoto', 'major outer reap']),
  ('O-Uchi Gari',          'standup', ARRAY['ouchi', 'inner reap']),
  ('Foot Sweep',           'standup', ARRAY['de ashi barai', 'sweep']),
  ('Snap Down',            'standup', ARRAY['snap', 'snapdown']),
  ('Ankle Pick',           'standup', ARRAY['ankle-pick']),
  ('Guard Pull',           'standup', ARRAY['pulling guard', 'guard-pull'])
ON CONFLICT (name) DO NOTHING;
