-- Schema for the local system-of-record database (docs/01-architecture.md §4).
-- Applied with CREATE ... IF NOT EXISTS, so running it on an existing database is safe.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS occupations (
  soc_code     TEXT PRIMARY KEY,          -- '2134', '213', 'ALL', 'UNKNOWN-4', 'UNKNOWN-3'
  name         TEXT NOT NULL,             -- label exactly as ONS publishes it
  slug         TEXT NOT NULL UNIQUE,
  level        INTEGER NOT NULL CHECK (level BETWEEN 0 AND 4),  -- 0 = all occupations / unknown
  parent_code  TEXT REFERENCES occupations(soc_code)
);

CREATE TABLE IF NOT EXISTS occupation_aliases (
  alias     TEXT PRIMARY KEY,
  soc_code  TEXT NOT NULL REFERENCES occupations(soc_code)
);

CREATE TABLE IF NOT EXISTS locations (
  code         TEXT PRIMARY KEY,          -- ONS code (E08000003, K02000001, TLD…) or 'UNKNOWN'
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('uk','country','region','lad','unknown')),
  parent_code  TEXT REFERENCES locations(code),
  itl2_name    TEXT                       -- ONS gives ITL2 names without codes
);

CREATE TABLE IF NOT EXISTS imports (
  id             INTEGER PRIMARY KEY,
  release_label  TEXT,
  latest_period  TEXT,
  published_on   TEXT,
  source_url     TEXT,
  filename       TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
  rows_read      INTEGER,
  rows_inserted  INTEGER,
  rows_updated   INTEGER,
  rows_unchanged INTEGER,
  error          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS imports_sha_succeeded ON imports(sha256) WHERE status = 'succeeded';

CREATE TABLE IF NOT EXISTS observations (
  soc_code        TEXT NOT NULL REFERENCES occupations(soc_code),
  location_code   TEXT NOT NULL REFERENCES locations(code),
  period          TEXT NOT NULL,           -- '2026-08' (monthly) or '2026-Q2' (quarterly)
  adverts         INTEGER CHECK (adverts IS NULL OR adverts >= 0),
  status          TEXT NOT NULL CHECK (status IN ('value','suppressed')),
  source_table    TEXT NOT NULL,           -- 'T1'..'T5'
  first_import_id INTEGER NOT NULL REFERENCES imports(id),
  last_import_id  INTEGER NOT NULL REFERENCES imports(id),
  PRIMARY KEY (soc_code, location_code, period),
  CHECK ((status = 'suppressed') = (adverts IS NULL))
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS obs_location_period ON observations(location_code, period);

CREATE TABLE IF NOT EXISTS observation_revisions (
  soc_code      TEXT NOT NULL,
  location_code TEXT NOT NULL,
  period        TEXT NOT NULL,
  old_adverts   INTEGER,
  new_adverts   INTEGER,
  old_status    TEXT NOT NULL,
  new_status    TEXT NOT NULL,
  import_id     INTEGER NOT NULL REFERENCES imports(id)
);

-- ONS's own "Data issue" paragraphs from the cover sheet of each imported release (S-010).
CREATE TABLE IF NOT EXISTS data_issues (
  import_id  INTEGER NOT NULL REFERENCES imports(id),
  position   INTEGER NOT NULL,            -- order on the cover sheet
  heading    TEXT NOT NULL,
  text       TEXT NOT NULL,
  PRIMARY KEY (import_id, heading)
);
