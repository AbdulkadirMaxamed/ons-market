# ONS workbook: what's actually in it

Profiled from `ons-data.xlsx` (published 25 September 2026, covering January 2017 – August 2026).
Re-check this against every new release; the importer must validate it, not assume it.

## Release facts

- Title: *Labour Demand Volumes by Standard Occupation Classification (SOC2020), UK: January 2017 - August 2026*
- Source: Textkernel online job adverts (~90,000 job boards and recruitment pages), processed by ONS.
- Status: **official statistics in development** (formerly "experimental"). The site must say so.
- Metric: **New adverts**, meaning adverts appearing online for the first time in that calendar month. The snapshot (live adverts) metric was withdrawn in September 2025.
- **ONS removes duplicate adverts** (same job on several boards), so "one role may appear on many sites" is mostly handled upstream. The site copy should say duplicates are removed *where detected*.
- Values are unrounded and can be summed across hierarchies, except where ONS imputed data (Oct 2025 – Feb 2026, Jul 2026), where totals may not add up exactly.
- File size ~49 MB. About one month's lag (August data published late September).

## Sheets

| Sheet | Contents | Header row | Key columns | Periods | Rows |
|---|---|---|---|---|---|
| Cover sheet | Description, data-quality notices (one paragraph per issue) | – | – | – | – |
| Table of contents | Links + titles of Tables 1–7 | 3 | – | – | – |
| Notes | Note 1–14, which tables they apply to | 3 | Note number · Tables · Text | – | 14 |
| Table 1 | Country × month | 5 | `Country` | `Jan-17` … `Aug-26` (116) | 6 (Total UK, 4 nations, Unknown) |
| Table 2 | Local authority × month (all occupations) | 5 | `Region`, `ITL2`, `Local Authority District`, `Local Authority Code` | 116 months | 329 |
| Table 3 | Region (ITL1) × **4-digit SOC** × month | 5 | `Region`, `SOC 4 digit code`, `SOC 4 digit label` | 116 months | 5,369 (13 areas × 413 codes) |
| Table 4 | Local authority × **3-digit SOC** × month | 5 | `Region`, `ITL2`, `Local Authority District`, `SOC 3 digit code`, `SOC 3 digit label`, `Local Authority Code` | 116 months | 34,415 |
| Table 5 | Local authority × **4-digit SOC** × **quarter** | 5 | same as Table 4 with 4-digit SOC | `2017Q1` … `2026Q2` (38) | 134,593 |
| Table 6 | LAD → Mayoral Combined Authority lookup | 5 | `Local Authority Code`, `Local Authority`, `Mayoral Combined Authority` | – | ~72 |
| Table 7 | LAD → LSIP area lookup (two side-by-side tables, 2023 and 2025) | 6 | – | – | ~296 |

Rows 1–4 of each data table are title, subtitle, notes pointer and a "Back to contents" hyperlink formula. Row 5 is the header.

## Values

- Integers, or the string **`[x]`** = suppressed by ONS for quality reasons. Treat as missing.
- Real `0` values are common (about 8k in Table 3, about 20% of Table 5 cells).
- SOC codes are **strings** (`'2134'`, `'213'`). Keep them as strings; leading zeros aren't used in SOC, but the type matters for joins.
- An extra code `Unknown` / `Unknown` exists in Tables 3 and 4 (adverts that couldn't be coded). Table 1 has an `Unknown` country row. Import them but exclude from search and rankings.
- Period headers are strings: `Mon-YY` (monthly) and `YYYYQn` (quarterly).

## Geography

- 12 ITL1 regions + `Total UK` (Table 3).
- 329 Local Authority Districts (LAD 2023 boundaries, April 2023). **London is one row** ("London", no LAD code): ONS assigns London boroughs to region level (Note 2).
- ITL2 names come with each LAD row (37 distinct). They can serve as the parent between LAD and region.
- Combined authorities (Greater Manchester etc.) are not tables, only a lookup (Table 6). They could be built by summing LADs (see suggestion S-002).

## Suppression and quality notices (as of this release)

| Period | What happened | Effect in data |
|---|---|---|
| Jan 2017 | Start of series | Treat the first month with caution |
| Jul–Aug 2023 | Large drop in source data | Real-looking dip; ONS says the long-term decline matches its vacancy survey |
| Jun–Jul 2025 | A large source dropped out | Affected series `[x]` (1,274 series in Table 3; 42% of Table 5 for Q2 and Q3 2025) |
| Dec 2025 | Source dropped out | 39 series `[x]` in Table 3, plus a caution list of seven SOC codes (Note 9) |
| Feb 2026 | Source dropped out | 117 series `[x]` in Table 3 |
| **Mar 2026** | Major source failure | **Every series `[x]`**, so **2026 Q1 is fully suppressed** in Table 5 |
| Jun–Jul 2026 | Sources dropped out | 1,937 / 273 series `[x]` in Table 3; 55% of Table 5 for Q2 2026 |
| Aug 2026 | Volatility | 377 series `[x]`; SOC 2 × South East flagged |
| Oct 2025 – Feb 2026, Jul 2026 | Partially **imputed** by ONS | Values revised; month-on-month changes unreliable |

ONS explicitly says that since November 2025 users should "exercise more caution in tracking month on month changes" and focus on longer-term trends. This shapes the design (see `02-design.md`).

## Small numbers (Table 5, local authority × 4-digit SOC, per quarter)

| Quarter | Suppressed | Zero | Under 10 | 100+ | Median |
|---|---|---|---|---|---|
| 2025Q1 | 0% | 21% | 70% | 2.2% | 4 |
| 2025Q4 | 0.7% | 22% | 73% | 1.8% | 3 |
| 2026Q1 | 100% | – | – | – | – |
| 2026Q2 | 55% | 9% | 30% | 1.3% | 4 |

Most local × occupation series are tiny. Percentage change is only meaningful for a small share of them; hence the minimum-volume rule in `01-architecture.md`.

## Spot checks (verified by reading the sheet)

| Series | Values |
|---|---|
| Manchester · 2134 Programmers & software development professionals (Table 5) | 2022Q2 4,248 · 2025Q2 1,673 · 2026Q1 `[x]` · 2026Q2 1,362 |
| North West · 2134 (Table 3) | Jun-26 1,827 · Jul-26 928 · Aug-26 1,123 · Mar-26 `[x]` |
| Manchester · 213 IT professionals (Table 4) | Jul-26 1,303 · Aug-26 1,541 |
| Total UK, all occupations (Table 1) | Aug-25 694,996 · Aug-26 720,638 |

## First import (2026-10-08)

`pnpm data:import data/raw/ons-2026-08.xlsx` imported 9,768,338 values in about 4.5 minutes, giving a 690 MB local database.

| Table | Values | Suppressed `[x]` | Zeros |
|---|---|---|---|
| T1 | 696 | 6 | 0 |
| T2 | 38,164 | 606 | 2 |
| T3 | 622,804 | 10,660 | 7,989 |
| T4 | 3,992,140 | 73,961 | 573,660 |
| T5 | 5,114,534 | 322,260 | 1,087,175 |

- 412 four-digit and 104 three-digit SOC codes, plus `Unknown` (stored as `UNKNOWN-4` / `UNKNOWN-3`).
- 328 local authorities plus London (stored as region `TLI`), 12 ITL1 regions, 4 countries, the UK (`K02000001`) and `UNKNOWN`.
- Spot checks match the spreadsheet: UK all jobs Aug-26 720,638 · NW 2134 Aug-26 1,123 · Manchester 213 Aug-26 1,541 · Manchester 2134 2026-Q2 1,362, 2026-Q1 `[x]`.
- Total UK is **not** the sum of regions (2134, Aug-26: 11,591 vs 11,547).
