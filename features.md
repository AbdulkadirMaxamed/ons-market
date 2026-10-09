# Features

Approved scope. Only items approved by the project owner live here; new ideas go to `suggestions.md` first.
`[ ]` planned · `[~]` in progress · `[x]` done

## Phase 1: architecture
- [x] Profile the real ONS workbook (`docs/03-workbook.md`)
- [~] Architecture, schema, API, import strategy, deployment, risks (`docs/01-architecture.md`), awaiting review
- [x] Decide data cadence: hybrid with a Monthly/Quarterly switch, Monthly by default (`docs/01-architecture.md` §1)

## Phase 2: design
- [x] UI/UX direction (`docs/02-design.md`)
- [x] Mockup explorer: four visual directions × three data options, phone and desktop, light and dark, ink-in and split-flap (`mockups/explorer.html`)
- [x] Design collages 1–7 (`mockups/collages/`)
- [x] Pick a visual direction and finalise tokens (`docs/02-design.md` §13, `mockups/design.html`)

## Phase 3: scaffold
- [x] React Router (framework mode, v8.4) + TypeScript + Tailwind v4 on Cloudflare Workers, pnpm
- [x] Design tokens (light + dark), Lexend, site header/footer, error and 404 page
- [x] About the data page (first version)
- [ ] Spike: free-plan CPU time for the result page
- [x] Python pipeline project (uv): `schema.sql`, CLI (`pnpm data:import`, `pnpm data:status`)
- [~] Shard loader (`data.server.ts`) and formatting helpers
- [~] Homepage with occupation and location search (layout done; search needs exported data)
- [ ] Result page: hero (number, pill, drawing sparkline), three cards, chart, other places, about this data
- [ ] Monthly/Quarterly switch driving the whole result page (Monthly default)
- [ ] Chart: gaps for missing data, notice bands, range tabs, table view, keyboard support
- [ ] Ink-in entrance and line-drawing animation for sparkline and chart (reduced-motion safe)
- [ ] Light and dark theme
- [ ] Tests: metrics (pytest), formatting and loaders (Vitest)

## Phase 4: real data
- [x] Workbook structure validator (fails loudly on layout change)
- [x] Parse Tables 1, 2, 3, 4, 5; `[x]` → missing (lookup Tables 6–7 come with S-002)
- [x] Transactional upsert with revision log and import log; idempotent re-import
- [x] Importer tests: missing values, duplicates, revisions, same-release re-import, malformed workbook, new layout, rollback (14 passing)
- [ ] Metrics: latest, previous-period and year-on-year change, 3-month rolling, 5-year average, 12-month high/low, percentile, trend word
- [ ] Minimum-volume rule for percentages
- [ ] JSON shard export
- [x] Import the September 2026 release and spot-check values against the spreadsheet

## Approved suggestions
- [ ] S-001 · Automated release check and import (scheduled GitHub Action, deploy only on success)
- [ ] S-002 · Combined areas built from local authorities (Greater Manchester etc.), missing if any part is suppressed
- [ ] S-003 · Friendly job names, search aliases and shorter URLs
- [ ] S-004 · Shareable result: copy-a-sentence button and Open Graph image per result page
- [ ] S-005 · Compare two places or two jobs
- [ ] S-007 · Share of all adverts in the area, and how it has changed
- [ ] S-008 · "Cooked meter" wording (Not cooked / Simmering / Cooked) shown next to the plain trend word
- [x] S-009 · Ticker-triangle (▲▼) logo and favicon

## Phase 5: polish
- [ ] Occupation and location ranking pages (paginated)
- [ ] Public `/api/*` routes with input validation
- [ ] About the data page (methodology, caveats, ONS notices)
- [ ] SEO: metadata, stable URLs, sitemap
- [ ] Accessibility pass (contrast, keyboard, screen reader, text alternative for charts)
- [ ] Caching headers
- [ ] Deploy to isthemarketcooked.com
- [ ] README: monthly import and deploy routine
