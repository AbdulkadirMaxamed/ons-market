# isthemarketcooked.com

A public UK job-market intelligence site built on ONS "Labour demand volumes by SOC 2020" data.
Users pick an occupation and a location and see how online job adverts are trending.
Goal: turn anecdote ("the software market is dead") into evidence.

Read `docs/01-architecture.md` (Phase 1) and `docs/02-design.md` (Phase 2) before building anything.
`docs/03-workbook.md` documents the real ONS workbook layout; never guess sheet or column structure.

## Stack (decided 2026-10-05)

- React Router v8 (framework mode, SSR; v7's successor) · TypeScript · React · Tailwind v4 · pnpm · Node ≥ 22.22
- Hosted on Cloudflare Workers (free plan)
- Data: Python importer (uv, openpyxl, pandas) → local SQLite (system of record) → exported static JSON shards deployed with the site
- No runtime database, no backend services, no paid infrastructure

## Workflow rules

- **Suggestions vs features:** new ideas go in `suggestions.md` as `S-###` with status `pending`. Only move one into `features.md` after the user explicitly approves it. Rejected ones stay in `suggestions.md` marked `rejected` with a reason; don't re-suggest them.
- `features.md` checklist: `[ ]` planned · `[~]` in progress · `[x]` done. Update it as work lands.
- **Do not commit.** The user makes all git commits themselves.
- Keep it light: no release process, CHANGELOG or tags until Phase 5.
- Importing is manual for now: the user downloads the XLSX into `data/raw/` and runs the import command.

## Data rules (non-negotiable)

- Never fabricate ONS data. Illustrative data must be labelled as illustrative.
- `[x]` (suppressed) and absent values stay missing (`null`); never convert to 0. Real zeros exist and are different.
- No percentage change against a missing or zero comparison period.
- Say "online job adverts" / "new adverts", never "vacancies" or "jobs available".
- SOC 2020 codes are canonical occupation IDs; ONS geography codes (LAD 2023) are canonical location IDs.
- Re-imports upsert: ONS revises history (e.g. imputed Oct 2025–Feb 2026), so the DB must reflect the latest release.
- Small numbers: below the minimum-volume threshold, don't show percentage changes.
- No market score (removed by the user).
- Result pages default to Monthly (local = broader 3-digit job, labelled); Quarterly = exact 4-digit job. Monthly year-on-year comparisons use 3-month windows.
