<p align="center">
  <img src="public/icon-512.png" width="88" alt="isthemarketcooked logo: an up and a down triangle">
</p>

<h1 align="center">isthemarketcooked.com</h1>

<p align="center">
  <strong>Is the job market for your role actually cooked, or does it just feel that way?</strong><br>
  UK job-market intelligence built on official ONS data.
</p>

---

## What it is

Everyone has an opinion on the job market. *"Software is dead." "Nobody's hiring in Manchester." "It's never been this bad."*
**isthemarketcooked.com** swaps the anecdotes for evidence.

Pick an **occupation** and a **location**. You'll see how many new online job adverts there are, how that compares with last year and the five-year average, and which way the trend is going. The figures come from the Office for National Statistics dataset
[*Labour demand volumes by Standard Occupation Classification (SOC 2020), UK*](https://www.ons.gov.uk/).

### What a result page shows

- **The headline:** the latest number of new online job adverts, a ▲/▼ change pill and a sparkline that draws itself in.
- **Three cards:** the five-year average, the last month or quarter, and a plain trend word (*Growing*, *Steady* or *Shrinking*).
- **The main chart:** a line and area chart with a dashed five-year average. Months ONS suppressed show as hatched gaps, labelled with ONS's reason.
- **A Monthly / Quarterly switch:**
  - **Monthly** (the default) is the most up-to-date view. For a local area it uses the broader 3-digit job group, for example *IT professionals*.
  - **Quarterly** shows the exact 4-digit job, for example *Programmers and software development professionals*, in every local authority.
- **Other places:** how the same job is doing in other areas.
- **About this data:** plain-English caveats, so nobody reads more into the numbers than they support.

## Honest data, by design

The data rules are written into the code and the tests:

- **Nothing is made up.** Every figure on the site is an ONS figure, or is calculated directly from ONS figures.
- **Missing isn't zero.** Values ONS suppresses (`[x]`) stay missing and show as gaps, while real zeros stay zero.
- **No misleading percentages.** There's no % change against a missing or zero period, and no percentages or trend words below a minimum of 30 adverts.
- **Monthly comparisons smooth out the noise.** Year-on-year compares the last three months with the same three months a year earlier, as ONS advises caution with month-on-month moves.
- **Accurate wording.** The site counts *online job adverts*, not vacancies or jobs available.
- **Revisions are respected.** When ONS revises history, the next import updates it and logs the old and new values.

## How it works

```
ONS workbook (.xlsx)
      │  pnpm data:import         validated, transactional, idempotent
      ▼
Local SQLite database             system of record (stays on your machine)
      │  pnpm data:export         metrics + small JSON files
      ▼
public/data/*.json                deployed with the site as static assets
      │
      ▼
React Router (SSR) on Cloudflare Workers   →   isthemarketcooked.com
```

There's no runtime database, no backend services and no paid infrastructure. The site runs on the Cloudflare Workers free plan.

## Tech stack

| Layer | Tools |
|---|---|
| Web app | React Router v8 (framework mode, SSR), React 19, TypeScript |
| Styling | Tailwind CSS v4, Lexend, light and dark themes |
| Hosting | Cloudflare Workers + static assets |
| Data pipeline | Python 3.12, uv, openpyxl, SQLite |
| Tests | pytest (pipeline), Vitest (web, planned) |
| Package manager | pnpm |

## Getting started

### Prerequisites

- **Node.js 22.22 or newer.** `.node-version` pins Node 22, so fnm, nvm and similar tools pick it up.
- **pnpm**
- **[uv](https://docs.astral.sh/uv/)** for the Python pipeline

### Install and run

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Until data has been imported and exported, the homepage tells you that no ONS data is loaded yet.

### Load the ONS data

1. Download the latest *Labour demand volumes by SOC 2020, UK* workbook from the ONS website.
2. Save it as `data/raw/ons-YYYY-MM.xlsx`, where `YYYY-MM` is the latest month it covers.
3. Import it:

```bash
pnpm data:import data/raw/ons-2026-08.xlsx
pnpm data:status   # recent imports and their results
pnpm data:export   # write the JSON data files the site reads (public/data/)
```

The importer checks the workbook's layout before it writes anything. If ONS changes a column, a period heading or a value format, the importer stops, names the exact cell (for example `Table 2!F6`) and leaves the database unchanged. Re-importing the same file does nothing.

If ONS has added a new data issue to the workbook's cover sheet, the import stops and names it. Add a short entry for it to `pipeline/notices.toml` (which periods it covers, why, and whether the data was not collected, withheld or estimated), then import again. This is how every gap on the site gets ONS's reason.

> Raw workbooks and the SQLite database are gitignored. They never go into the repository or the deployed site.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm preview` | Build and preview locally |
| `pnpm deploy` | Build and deploy to Cloudflare Workers |
| `pnpm typecheck` | Generate types and run TypeScript |
| `pnpm data:import <file>` | Import an ONS workbook into SQLite |
| `pnpm data:export` | Calculate the comparisons and write `public/data/*.json` |
| `pnpm data:status` | Show recent imports |
| `pnpm test:pipeline` | Run the pipeline tests |

## Project structure

```
app/                 React Router app (routes, components, styles)
  lib/data.server.ts   reads the exported JSON data files
workers/             Cloudflare Worker entry point
public/              static assets (logo, favicons, exported data/)
pipeline/            Python data pipeline
  ons/workbook.py      reads and validates the ONS workbook
  ons/importer.py      transactional upsert into SQLite
  ons/metrics.py       comparisons, trend word, small-numbers rule
  ons/export.py        SQLite → JSON data files
  ons/schema.sql       database schema
  notices.toml         why figures are missing or estimated, per ONS data issue
  tests/               pytest suite
docs/                architecture, design and workbook profile
mockups/             design explorations and the final reference design
features.md          approved feature checklist
suggestions.md       ideas waiting for approval
```

## Documentation

- [`docs/01-architecture.md`](docs/01-architecture.md): architecture, schema, data files, metrics, import and deployment
- [`docs/02-design.md`](docs/02-design.md): UI/UX direction and final design decisions
- [`docs/03-workbook.md`](docs/03-workbook.md): what is actually inside the ONS workbook
- [`features.md`](features.md): what's built and what's next

## Status

🚧 **In development.** The architecture, the design and the ONS importer are done, and the first real release is imported and verified. The metrics, the data export and the result page are being built now. See [`features.md`](features.md) for the live checklist.

## Data source and attribution

Source: Office for National Statistics, *Labour demand volumes by Standard Occupation Classification (SOC 2020), UK*. These are **official statistics in development**, based on online job adverts collected by Textkernel.

Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).

---

<p align="center">© 2026 Abdulkadir Maxamed. All rights reserved.</p>
