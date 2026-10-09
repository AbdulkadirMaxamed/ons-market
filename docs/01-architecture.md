# Phase 1: product and architecture

Status: **draft for review** · 2026-10-05
Based on the brief, the real workbook (`03-workbook.md`) and decisions made so far:
React Router v7 · free hosting · manual imports · no market score.

---

## 1. Product definition

**isthemarketcooked.com** answers one question:

> How many online job adverts are there for this kind of job, in this place, and is that going up or down?

- **Who it's for:** ordinary job seekers, career changers, students, and anyone who has heard "the market is dead" and wants to check.
- **What it is:** a plain-English reading of ONS online job-advert data, one occupation and one place at a time.
- **What it isn't:** a job board, a salary tool, a recruiter, or a forecast. It never says "vacancies" or "jobs available".

**The core page answers four things, in this order:**

1. **How many?** The latest new online adverts, with the period they cover.
2. **Compared with a year ago?** Year-on-year change, as a number, a percentage and a word.
3. **Compared with normal?** Against the 5-year average, and where the latest figure sits in that range.
4. **Which way is it heading?** A chart of the history, with gaps where ONS has no data.

Month-on-month (or quarter-on-quarter) change is shown, but it is **not the headline**. ONS itself warns that short-term changes have been unreliable since November 2025. Leading with them would make us less trustworthy than the source. This is a deliberate departure from the brief; see §8.

**Product sentence the page should be able to produce** (real data):

> New online adverts for programmers and software developers in Manchester were 1,362 in April–June 2026. That's 18.6% fewer than a year earlier, and 44% below the 5-year average.

(The 5-year average uses the 19 available quarters from 2021Q3 to 2026Q2: 2,439.)

### Data cadence: decided 2026-10-08

**Hybrid, with a Monthly / Quarterly switch on the chart that drives the whole page. Monthly is the default.**

- **Monthly** (default). For a local authority, the figures are for the **broader 3-digit job group in that place** (Table 4), for example *IT professionals (SOC 213), which includes software developers*. A banner says so. For the UK and regions, monthly data is the exact 4-digit job (Table 3).
- **Quarterly**: the **exact 4-digit job in that place** (Table 5), latest Apr–Jun 2026.
- Switching updates the headline number, the year-on-year pill, the three cards, the chart, its ranges and the "other places" list.
- In Monthly, every "vs a year ago" comparison (pill, trend and other places) uses **the last 3 months vs the same 3 months a year earlier**, because ONS warns that single-month changes are unreliable. The headline number is still the latest single month.
- **Table 4 is now part of the MVP import.**

Options considered (kept for reference):

| Option | Local authority + 4-digit job | Region / UK + 4-digit job | Freshness |
|---|---|---|---|
| **Hybrid** (recommended) | Quarterly (Table 5) | Monthly (Table 3) | Local: up to Q2 2026. Regional: up to Aug 2026 |
| Quarterly only | Quarterly (Table 5) | Quarterly (Table 3, summed) | Q2 2026 everywhere |
| Monthly only | 3-digit job only (Table 4) | Monthly (Table 3) | Aug 2026 everywhere |

The architecture below supports all three. Only the exporter and the result page change.

---

## 2. Architecture

```
  You (monthly, manual)
        │  download XLSX from ons.gov.uk
        ▼
  data/raw/ons-2026-08.xlsx  ──(archived, never deleted, git-ignored, backed up)
        │
        ▼
  pnpm data:import <file>            Python (uv) · pipeline/
  ├─ hash file (SHA-256) · skip if already imported
  ├─ validate workbook structure (sheets, header rows, period columns)
  ├─ parse Tables 1, 2, 3, 5 (+ lookups) → long format, [x] → NULL
  ├─ validate values (ints ≥ 0 or NULL, known codes, period ranges)
  ├─ BEGIN; upsert observations; log revisions; record import; COMMIT
  │      any failure → ROLLBACK, import row marked failed, DB untouched
        ▼
  data/db/job-market.sqlite          system of record (local only)
        │
        ▼
  pnpm data:export                   Python
  ├─ compute metrics per series (one implementation, tested)
  └─ write JSON shards → build/data/ (git-ignored, regenerated)
        │
        ▼
  pnpm deploy                        wrangler → Cloudflare Workers (free)
  ├─ static assets: JSON shards, JS, CSS, fonts     (free, not metered)
  └─ Worker: React Router v7 SSR
        loaders read shards via the ASSETS binding → HTML
        /api/* resource routes read the same shards → JSON
```

### Why this shape

- **SQLite stays the source of truth** for audit, upserts, revisions and the import log, but **the website never opens it**. A database server is the only thing in a site like this that costs money or breaks at runtime. Pre-computed JSON removes both problems.
- **Data only changes once a month,** so computing everything at import time is cheap and makes every page a single small file read.
- **Metrics are computed once, in Python,** and stored in the shards. The TypeScript side only formats them, so there's no second implementation to drift out of sync.

### Changes to the brief (and why)

| Brief | Now | Why |
|---|---|---|
| Next.js | React Router v7 | Same SSR and loaders model, which you're practising. It has an official Cloudflare Workers template. |
| Website queries SQLite | Website reads JSON exported from SQLite | Free hosting with no database at runtime. SQLite still does every job the brief gives it. |
| Drizzle ORM | Plain SQL in Python (`pipeline/schema.sql`) | Only Python touches the database. Drizzle would add a second schema definition for nothing. |
| GitHub Action importer | Manual import command | Your call. Automation is suggestion S-001 and reuses the same script. |
| Market score | Removed | Your call. A transparent trend word stays (§6). |

---

## 3. Repository structure

```
/
  app/                         React Router v7 app
    routes/
      _index.tsx               homepage (search)
      market.$occupation.$location.tsx   result page
      occupation.$occupation.tsx         one job across the UK (rankings by place)
      location.$location.tsx             one place (rankings by job)
      about-data.tsx           methodology and caveats
      api.market.ts            GET /api/market
      api.history.ts           GET /api/market/history
      api.rankings.ts          GET /api/rankings
      api.search.ts            GET /api/search (occupations and locations)
    components/                UI (see 02-design.md §5)
    lib/
      data.server.ts           shard loading and caching (the only file that knows the shard layout)
      format.ts                numbers, periods, change wording
      slugs.ts
    root.tsx · app.css (Tailwind v4 + tokens)
  workers/app.ts               Cloudflare entry
  wrangler.jsonc
  pipeline/                    Python, uv project
    pyproject.toml
    schema.sql
    notices.yaml               quality notices per period (curated from the cover sheet)
    ons/
      workbook.py              structure validation and parsing (no DB code)
      db.py                    connection, migrations, upsert
      importer.py              orchestration: hash → validate → parse → transaction
      metrics.py               pure functions, heavily tested
      export.py                SQLite → JSON shards
      cli.py                   `import`, `export`, `status`
    tests/
      fixtures/                tiny workbooks built by the tests themselves (never real data edited by hand)
  data/                        git-ignored
    raw/ons-2026-08.xlsx
    db/job-market.sqlite
  build/data/                  git-ignored, generated shards
  tests/                       TypeScript tests (Vitest) for format and loaders
  docs/  mockups/
  features.md  suggestions.md  CLAUDE.md
```

`package.json` scripts wrap Python so the whole workflow uses one tool:
`pnpm data:import`, `pnpm data:export`, `pnpm dev`, `pnpm test`, `pnpm deploy`.

---

## 4. Database schema (SQLite)

```sql
CREATE TABLE occupations (
  soc_code     TEXT PRIMARY KEY,          -- '2', '21', '213', '2134', or 'ALL'
  name         TEXT NOT NULL,             -- official SOC 2020 label
  slug         TEXT NOT NULL UNIQUE,
  level        INTEGER NOT NULL CHECK (level BETWEEN 0 AND 4),  -- 0 = all occupations
  parent_code  TEXT REFERENCES occupations(soc_code)
);

CREATE TABLE occupation_aliases (           -- empty in the MVP, ready for search terms
  alias     TEXT PRIMARY KEY,               -- lowercase: 'software engineer'
  soc_code  TEXT NOT NULL REFERENCES occupations(soc_code)
);

CREATE TABLE locations (
  code         TEXT PRIMARY KEY,          -- ONS code (E08000003) or synthetic ('UK', 'RGN-NW', 'LONDON')
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  type         TEXT NOT NULL CHECK (type IN ('uk','country','region','itl2','lad')),
  parent_code  TEXT REFERENCES locations(code)
);

CREATE TABLE imports (
  id             INTEGER PRIMARY KEY,
  release_label  TEXT NOT NULL,           -- 'January 2017 - August 2026'
  latest_period  TEXT NOT NULL,           -- '2026-08'
  published_on   TEXT,                    -- '2026-09-25' (from cover sheet)
  source_url     TEXT,
  filename       TEXT NOT NULL,
  sha256         TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','skipped')),
  rows_read      INTEGER, rows_inserted INTEGER, rows_updated INTEGER, rows_unchanged INTEGER,
  error          TEXT
);
CREATE UNIQUE INDEX imports_sha_succeeded ON imports(sha256) WHERE status = 'succeeded';

CREATE TABLE observations (
  soc_code        TEXT NOT NULL REFERENCES occupations(soc_code),
  location_code   TEXT NOT NULL REFERENCES locations(code),
  period          TEXT NOT NULL,           -- '2026-08' (monthly) or '2026-Q2' (quarterly)
  adverts         INTEGER CHECK (adverts IS NULL OR adverts >= 0),   -- NULL = no observation
  status          TEXT NOT NULL CHECK (status IN ('value','suppressed')),
  source_table    TEXT NOT NULL,           -- 'T3', 'T5'… so we know which ONS table each value came from
  first_import_id INTEGER NOT NULL REFERENCES imports(id),
  last_import_id  INTEGER NOT NULL REFERENCES imports(id),
  PRIMARY KEY (soc_code, location_code, period),
  CHECK ((status = 'suppressed') = (adverts IS NULL))
) WITHOUT ROWID;
CREATE INDEX obs_location_period ON observations(location_code, period);  -- rankings by place

CREATE TABLE observation_revisions (       -- audit trail when ONS changes history
  soc_code TEXT, location_code TEXT, period TEXT,
  old_adverts INTEGER, new_adverts INTEGER,
  old_status TEXT, new_status TEXT,
  import_id INTEGER NOT NULL REFERENCES imports(id)
);
```

**Notes**

- **Missing vs zero:** `status='suppressed'` and `adverts NULL` mean ONS printed `[x]`. A period that isn't in the table at all means ONS didn't publish it. Both mean "no observation", but suppressed lets us say *why*. `0` means zero adverts.
- **Monthly and quarterly** live in the same table, told apart by the period format. Table 3 regional and Table 5 local series never share a (job, place) key, so they can't collide.
- **Upsert:**
  ```sql
  INSERT … ON CONFLICT(soc_code, location_code, period) DO UPDATE SET
    adverts = excluded.adverts, status = excluded.status, last_import_id = excluded.last_import_id
  ```
  A revision row is written first when the value or status changed.
- **Size:** about 5.8M observation rows for Tables 1, 2, 3 and 5, so roughly 200–300 MB. That's fine locally and never deployed. Table 4 (3-digit local, monthly) is imported too, adding about 4M rows (local DB only).
- **Idempotent:** if a file's SHA-256 matches a `succeeded` import, the import exits as `skipped`. Re-running a different file with the same release label still upserts safely.

---

## 5. Data served to the website ("API")

### JSON shards (static, generated by `data:export`)

| File | Contents | Size (real export, uncompressed) |
|---|---|---|
| `meta.json` | release label, published date, latest month and quarter, periods ONS withheld everywhere, and `notices`: each ONS data issue with its cause (`not_collected` · `withheld` · `estimated` · `caution`), periods, our short reason and ONS's full text (S-010) | 7 KB |
| `search.json` | every 4-digit job (code, name, slug, 3-digit group), every 3-digit group name, every place (UK, regions incl. London, local authorities) | 89 KB |
| `overview.json` | homepage: UK all-jobs monthly series, the UK jobs rising and falling fastest (3 months vs a year earlier, at least 1,500 adverts a year earlier) | 4 KB |
| `occupation/{soc4}.json` | one exact job: **monthly** for the UK and regions (Table 3); **quarterly** for every place (Table 5 for local authorities and London; whole quarters of Table 3 for the UK and other regions, marked `derived`) | up to 200 KB |
| `group/{soc3}.json` | one 3-digit job group: **monthly** for every local authority (Table 4). Feeds the Monthly view of a local authority | up to 290 KB |
| `location/{slug}.json` | one place, every job (rankings). **Deferred to Phase 5** with the ranking pages | – |

First real export (2026-10-09): 519 files, 96 MB, 59 seconds. Well inside the Workers static-asset limits (20,000 files, 25 MiB each).

Every series is an array aligned to the shard's `months` / `quarters` span, with `null` where ONS withheld the figure, plus its comparisons (`m`, see §6). A place with no figures at all has `m: null`.

**The result page needs at most two shards:** `occupation/2134.json` (Quarterly view, and Monthly for the UK and regions) and, for a local authority's Monthly view, `group/213.json`. Each one also holds every comparison place.

### Public JSON API (resource routes; validated with Zod)

| Route | Returns |
|---|---|
| `GET /api/search?q=soft&type=occupation` | up to 10 matches |
| `GET /api/market?occupation=2134&location=manchester` | everything the result page shows: latest, changes, averages, trend word, notices, cadence |
| `GET /api/market/history?occupation=2134&location=manchester&range=5y` | series `[{period, adverts \| null, status}]` |
| `GET /api/rankings?occupation=2134&page=1&limit=25&sort=adverts\|yoy` | places for one job |
| `GET /api/rankings?location=manchester&page=1&limit=25&sort=…` | jobs for one place |

- **Validation:** SOC must be in the known set; location slug or code must be in the known set; `limit` from 1 to 100; `page` 1 or more. Errors return `400` or `404` with `{ error: { code, message } }`.
- **Caching:** `Cache-Control: public, max-age=3600, s-maxage=86400`. Data changes monthly, and the deploy changes the asset hash.
- No raw SQL is exposed, and there's no database at runtime.

---

## 6. Metrics (computed in `pipeline/ons/metrics.py`)

For each series, using its own cadence (month or quarter):

| Metric | Rule | Missing / zero handling |
|---|---|---|
| `latest` | most recent period **with a value** | If the newest period is suppressed, say so ("No figure for Jul 2026; showing Jun 2026") |
| `prev_change` | latest − previous period | `null` if previous is missing |
| `prev_change_pct` | (latest − prev) / prev × 100 | `null` if prev missing **or 0**, or below the volume threshold |
| `yoy_change` / `yoy_change_pct` | against the same period 12 months / 4 quarters earlier | same rules |
| `rolling_yoy_pct` (monthly only) | last 3 months total vs the same 3 months a year ago | `null` if any of the 6 months is missing |
| `avg_5y` | mean of available values over the last 60 months / 20 quarters | needs at least 75% coverage, otherwise `null` |
| `vs_avg_5y_pct` | (latest − avg_5y) / avg_5y × 100 | `null` if avg is null or 0 |
| `high_12m` / `low_12m` | over available periods, with their dates | |
| `percentile_5y` | share of the last 5 years' periods with fewer adverts than the latest | `null` when `avg_5y` is |

**Trend word** (replaces the score). It's a fixed, visible rule, not a judgement:

- **Growing** ▲ means year-on-year change is +10% or more.
- **Steady** ► means it's between −10% and +10%.
- **Shrinking** ▼ means it's −10% or less.
- **Not enough data** means year-on-year is `null`.

For monthly series this uses the 3-month rolling figure, which ONS's own advice favours. If any of those six months is withheld, it falls back to the single-month year-on-year figure, and the page says which one it used (`basis`). The page shows the rule in a tooltip.

**Minimum volume** (proposed): percentages and trend words need **both values to be 30 or more**. Below that the page shows the counts and says "Too few adverts to measure change reliably". A count of 30 naturally varies by about ±18% from random chance alone, so smaller bases mostly show noise. This is one constant in `metrics.py`, and we can tune it after looking at real pages.

---

## 7. Import strategy

**Data issues (S-010):** before parsing values, the importer reads every "Data issue - …" section from the cover sheet and checks each heading is in `pipeline/notices.toml`. An unexplained one stops the import with its heading and first sentence. ONS's text is saved in `data_issues` and exported to `meta.json`.

1. `pnpm data:import data/raw/ons-2026-09.xlsx`
2. Hash the file. If a succeeded import has the same hash, log `skipped` and exit 0.
3. Open with `openpyxl` (read-only, streaming).
4. **Check structure before parsing anything:**
   - Required sheets exist.
   - Row 5 headers match the expected key columns exactly.
   - Period headers parse and are contiguous.
   - The cover sheet title contains "Labour Demand Volumes".

   Any mismatch stops the import with a message naming the sheet, cell, expected value and found value. A new layout must never be "mostly parsed".
5. Parse into long rows and check them:
   - values are int ≥ 0, or exactly `[x]`;
   - codes look right (4-digit SOC `^\d{4}$` or `Unknown`; LAD `^[EWSN]\d{8}$`, or blank for London);
   - no duplicate (job, place, period) within the file;
   - row counts are within ±5% of the last import (warn, don't fail).
6. Run one transaction: upsert reference tables, then observations and revisions, then the import row. On any exception: rollback, mark the import `failed` with the error, and exit non-zero. Before writing, the importer copies the DB to `job-market.sqlite.bak` as a second safety net.
7. Print a summary: rows inserted, updated (revisions) and unchanged; newest period; and five spot-check values to compare by eye against the spreadsheet.
8. `pnpm data:export` regenerates the shards. It refuses to run if the latest import failed.

**Tests (pytest)** cover parsing, `[x]`, real zeros, duplicate rows, revisions, same-file re-import, a malformed workbook, a changed layout (renamed header or moved column), and rollback on a mid-import failure. The tests build tiny workbooks in code.

---

## 8. Deployment

- **Cloudflare Workers, free plan.** Static assets are free and unmetered. The Worker gets 100k requests a day and 10 ms of CPU per request.
- Domain: `isthemarketcooked.com`, with DNS on Cloudflare (free). The domain is the only running cost.
- Deploy: `pnpm deploy`, which runs `react-router build` then `wrangler deploy`. Rollback is `wrangler rollback`.
- **SQLite implications:** none at runtime. The DB lives on your machine. Back up `data/raw/` and `data/db/`, for example in a cloud folder. If the DB is lost, re-importing the archived workbooks in order rebuilds it.

---

## 9. Key risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Free-plan 10 ms CPU limit on server rendering.** A React page render can come close to it. | Medium | A Phase 3 spike measures it first. Options: keep pages light; cache HTML with the Cache API (it changes once a month); pre-render occupation × region pages (about 5.4k) at build time. Last resort: Workers Paid ($5/month). |
| ONS changes the workbook layout or table numbering | High over time | Strict structure check; failures are loud and safe |
| Small numbers look dramatic (2 → 4 = "+100%") | Certain | Minimum-volume rule; show counts first |
| Suppressed recent periods (all of 2026 Q1; 55% of 2026 Q2) | Certain | "Latest available" logic; explain gaps on the chart |
| Users don't recognise SOC names ("Programmers and software development professionals") | High | Search matches inside names; alias table ready; short display names (S-003) |
| City names ≠ ONS areas (London is one area; "Edinburgh" is "City of Edinburgh") | Medium | Search covers LAD and region names; London is shown as a region |
| Statistics in development may be revised heavily or discontinued | Low–medium | Show the status, release date and notices on every page |
| Copy overstates certainty | Medium | Copy rules in `02-design.md` §11 |

---

## 10. Assumptions still to verify

Verified already, against the real workbook: sheet names, header rows, key columns, period formats, the `[x]` marker, real zeros, 412 SOC unit groups plus `Unknown`, 329 LADs, London as one row, Q1 2026 fully suppressed.

Still open:

1. **ONS download URL pattern and stable dataset page.** Needed only when automating (S-001).
2. **Whether table numbering stays stable between releases.** It changed in September 2025 when the snapshot tables were removed, so the validator matches tables by title text, not only by number.
3. **Whether revisions touch older periods or only the last ~12 months.** We'll measure this from the revision log after the second import.
4. ~~**Free-plan CPU time** for the result page.~~ **Answered 2026-10-09:** measured on the production build in workerd, against serving a static file as the baseline: about 3–4 ms for a page whose files are already parsed, plus 2–3.5 ms the first time an isolate parses a job's files (largest 285 KB). Worst case about 6–7 ms, under the 10 ms limit. Parsed files are cached per isolate (`data.server.ts`). Re-check after adding features to the page.
5. ~~Whether `Total UK` in Table 3 equals the sum of regions.~~ **Answered 2026-10-08: it doesn't.** For SOC 2134 in Aug 2026, Total UK is 11,591 but the regions plus Unknown sum to 11,547. Always use ONS's own Total UK row; never derive the UK from regions.

---

## 11. Recommended build order (first working MVP)

1. **Pipeline skeleton:** `schema.sql`, `workbook.py` structure check, then parse Table 3 only. Tests first.
2. **Full import:** Tables 1, 2, 3, 4 and 5, plus upsert, revisions, rollback and the import log. Then import the real workbook and spot-check it.
3. **`metrics.py` and `export.py`,** with tests for every edge case in §6. Generate the shards.
4. **React Router v7 scaffold on Cloudflare:** a deploy of a "hello" page, and the CPU spike on a real shard.
5. **The result page** (the product's core): headline figures, chart, comparison list, data panel.
6. **The homepage search,** with occupation and location comboboxes.
7. **About the data page,** and notices on the chart.
8. **Occupation and location ranking pages,** plus the `/api/*` routes.
9. **Polish:** SEO metadata, a sitemap of popular pairs, an accessibility pass, then deploy to the domain.
