# Phase 2: UI and UX direction

Status: **draft for review**. The visual direction and data cadence get picked from the mockups (`mockups/explorer.html`).
Guiding idea from you: *readability for everyone*. Someone who has never read a chart should understand the result page in 10 seconds.

---

## 1. Sitemap

```
/                                         Home: search (occupation + location)
/market/{occupation}/{location}           Result page (the product)
/occupation/{occupation}                  One job across the UK: places ranked
/location/{location}                      One place: jobs ranked, area totals
/about-data                               What the numbers are and aren't, notices, method
/api/*                                    Public JSON (see 01-architecture §5)
```

URL slugs come from official names:
`/market/programmers-and-software-development-professionals/manchester`.
The SOC code is the real key: slugs map to codes in `search.json`. If ONS renames something, the old slug gets a redirect. Shorter friendly slugs are suggestion S-003.

Page titles and descriptions:
- **Title:** "Software developer job market in Manchester | Is the market cooked?"
- **Description:** "Latest ONS online job-advert data for programmers and software developers in Manchester: 1,362 new adverts in Apr–Jun 2026, down 18.6% on a year earlier."

## 2. Homepage wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ isthemarketcooked                         About the data  ◐  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Is the market cooked?                                     │
│   Check real ONS job-advert data for your job, where        │
│   you live.                                                 │
│                                                             │
│   Job      [ Software developer…              ▾ ]           │
│   Where    [ Manchester                       ▾ ]           │
│            [ Check the market → ]                           │
│                                                             │
│   Popular: Software developers · Nurses · Electricians …    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  UK, all jobs · Aug 2026          720,638 new adverts       │
│                                   ▲ 3.7% on Aug 2025        │
│  Rising (3 months vs a year ago)  │  Falling                │
│  Veterinarians        ▲ 41%       │  Bricklayers    ▼ 34%   │
│  …                                │  …                      │
├─────────────────────────────────────────────────────────────┤
│  Source: ONS · Latest data Aug 2026 · Updated 25 Sep 2026   │
└─────────────────────────────────────────────────────────────┘
```

The search fills the first screen on every device. The overview sits below the fold and never competes with it.

## 3. Result page wireframe (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│ isthemarketcooked   [Software developer ▾][Manchester ▾][→] │
├─────────────────────────────────────────────────────────────┤
│ Programmers and software developers · SOC 2134              │
│ Manchester · North West                                     │
│                                                             │
│ ┌──────────┐  new online job adverts                        │
│ │1│,│3│6│2│  April – June 2026                              │
│ └──────────┘                                                │
│ "18.6% fewer adverts than a year ago, and 44% below the     │
│  5-year average."                                           │
│                                                             │
│ ┌ vs last year ─┐ ┌ vs 5-yr average ┐ ┌ vs last quarter ──┐ │
│ │ ▼ 18.6%       │ │ ▼ 44%           │ │ No figure:        │ │
│ │ −311 adverts  │ │ avg 2,439       │ │ Q1 2026 withheld  │ │
│ └───────────────┘ └─────────────────┘ └───────────────────┘ │
│ Trend: ▼ SHRINKING   (how we decide ⓘ)                      │
│                                                             │
│ Online adverts per quarter        [1Y][3Y][5Y][All]  Table  │
│  ╭─╮                                                        │
│ ╭╯ ╰──╮_                                                    │
│        ╰──╮__ ___   ┊gap┊ ●                                 │
│ 2021 … 2026        ░ = ONS adjusted   ┊ = no data           │
│                                                             │
│ [Hybrid only] Latest monthly signal · North West            │
│ Aug 2026: 1,123 · Jun–Aug vs a year ago ▲ x%                │
│                                                             │
│ Software developers in other places    │ Top jobs in Manch. │
│ London     7,421 ▼ …  ████████         │ 1 Sales accounts…  │
│ Bristol      732 ▼ …  █                │ 2 Programmers…     │
│                                                             │
│ About this data ─────────────────────────────────────────── │
│ Source ONS · Metric new online adverts · Latest Q2 2026     │
│ Updated 25 Sep 2026 · Official statistics in development    │
└─────────────────────────────────────────────────────────────┘
```

## 4. Mobile layout

- **Single column.** The search collapses into a one-line "Software developer · Manchester ✎" bar that opens a sheet.
- **Headline block first:** name, place, big number, sentence. All of it fits in the first screen at 375 px.
- The three comparison cards become a stacked list: label on the left, value on the right.
- The chart is full-bleed inside the 16 px gutter. Range buttons sit above it. Tapping shows a value and moves a crosshair. "Show as table" is always available.
- Comparison lists become simple rows with an inline bar.
- Tap targets are at least 44 px.

## 5. Component hierarchy

```
Root (fonts, theme, header, footer)
├─ SiteHeader ─ Logo · CompactSearch · ThemeToggle
├─ SearchForm ─ Combobox(occupation) · Combobox(location) · SubmitButton
├─ ResultPage
│  ├─ ResultHeading ─ occupation (short + official + SOC code) · location (+ parent)
│  ├─ Headline ─ FlapNumber (split-flap) · PeriodLabel · Verdict sentence
│  ├─ ChangeCards ─ ChangeCard × 3 (direction icon + word + value + sub-value | "no figure" reason)
│  ├─ TrendBadge (+ RuleTooltip)
│  ├─ TrendChart ─ RangeTabs · SVG (axis, line segments, gap markers, notice bands, endpoint) · Tooltip · DataTable
│  ├─ MonthlySignalCard (hybrid only)
│  ├─ RankingList (other places · other jobs) ─ RankingRow (name · value · change · bar)
│  └─ DataPanel ─ source, metric, latest, updated, notices, link to About
├─ OccupationPage / LocationPage ─ RankingTable (sortable, paginated)
└─ AboutDataPage
Shared: Change (formatted ▲/▼ + word + aria label), SmallNumberNote, InkIn (entrance), Tip
```

## 6. Design tokens (shared semantics; values depend on the chosen direction)

| Token | Meaning |
|---|---|
| `--bg`, `--surface`, `--surface-2` | page ground, panels, inset areas |
| `--ink`, `--ink-2`, `--ink-3` | main text, secondary, captions (all ≥ 4.5:1 on `--bg`) |
| `--rule` | hairlines and grid |
| `--accent` | brand, focus ring, the series line |
| `--up`, `--up-bg` | increase (**always paired with ▲ and a word**) |
| `--down`, `--down-bg` | decrease (**always paired with ▼ and a word**) |
| `--flat` | steady or no change |
| `--missing` | gaps, suppressed values, "no figure" |
| `--caution` | ONS-adjusted (imputed) periods |
| radius, spacing scale (4-based), shadow | per direction |

Light and dark are both defined from the start: it's cheap when every colour is a token.

## 7. Typography

- Numbers use **tabular figures** everywhere, so columns of numbers line up and changing values don't jiggle.
- **Big number:** 56–96 px. Period label right under it, always.
- **Body:** 16–17 px, line length capped at about 65 characters.
- **Labels:** sentence case. Uppercase is used only for small eyebrow labels, with letter-spacing.
- Each mockup direction proposes a font pairing. The "Bulletin" direction uses **Atkinson Hyperlegible**, which is designed for low-vision readability and fits the "readable for everyone" goal.

## 8. Colour strategy

- **Colour never carries meaning alone:** every change has an arrow (▲ ▼ ►), a word ("up", "down", "fewer", "more") and a sign.
- **Increase vs decrease:** green up, red down (decided in §13). The arrows and words are what keep this readable for colour-blind users.
- **Missing data** gets its own neutral hatched treatment, never the "down" colour.
- **One accent per direction.** Everything else is neutral.

## 9. Chart design

- One line, the selected series. The y-axis starts at **0** (adverts are counts, so a cropped axis exaggerates change). There are 3–4 horizontal gridlines with plain numbers.
- **Missing periods** are a break in the line plus a light hatched column labelled "No data". The line is never bridged across a gap and never dropped to zero.
- **ONS-adjusted periods** (imputed) get a faint band and a legend entry.
- The latest point is emphasised with a dot and a label.
- A dashed horizontal line marks the 5-year average, labelled.
- **Ranges:** monthly series get 6M · 1Y (default) · 3Y · 5Y · All. Quarterly series get 1Y · 3Y (default) · 5Y · All. Six months of quarters is two points, which isn't a trend.
- Pointer, touch and keyboard (arrow keys) all move a crosshair with a tooltip.
- A "Show as table" toggle gives the same data as an accessible `<table>`.
- **Animation:** the line draws left to right once (about 1.2 s) when it scrolls into view. It's disabled under reduced motion.

## 10. Empty, loading and error states

| State | What the user sees |
|---|---|
| Typing in search | Suggestions update as you type; "No matching job: try a broader word like 'engineer'" |
| No figure for the latest period | "ONS withheld the figure for Jan–Mar 2026 because of a data-supply problem. Showing the latest available period." |
| Small numbers | Counts shown; percentages replaced with "Too few adverts to measure change reliably", plus a link to the region or broader job |
| Whole series empty | "ONS doesn't publish figures for this job in this area" and the nearest alternatives |
| Bad URL (unknown job or place) | 404 page with search and "Did you mean…" |
| Loading | Server-rendered, so no spinners on navigation. The layout is fixed-size, so values ink in without shifting the page |
| Offline / error | "We couldn't load this page. The data is fine; try again." |

## 11. Copy rules

- Say "new online job adverts" first, then "adverts". Never "vacancies", "jobs available" or "openings".
- Always attach the period: "in April–June 2026", never "currently".
- Write changes as words: "18.6% fewer than a year earlier", not only "−18.6%".
- Say why data is missing whenever ONS told us.
- Never guess at causes ("because of AI").
- ONS is the source; the interpretation is ours. Say so wherever the trend word appears.

## 12. Motion

- **Headline:** the number inks in and the sparkline beside it draws from start to end (§13). Split-flap was dropped for the headline.
- **Ink-in:** secondary values fade in with a 2 px rise and a slight blur clearing (0.5 s, staggered).
- **Chart:** the line draws once.
- Everything is fully disabled under `prefers-reduced-motion`. Nothing animates size, so there's no layout shift.

---

## 13. Decisions (2026-10-08, from the collages)

Picks: **1B** (simplified) · **2H** · **3B** · **4B** · **5A** · **6A + 6D** · **7F**. Built in `mockups/design.html`; screenshots in `mockups/design-shots/`.

| Area | Decision |
|---|---|
| Look | Ticker (1B), light-first. Calm grey ground, white panels with 1px rules, monochrome chart. The dense 2×2 KPI grid is **removed**. |
| Result layout | Number hero (3B): **hero box** (big number + period + year-on-year chip + drawing sparkline) → **three cards** (5-year average · last quarter/month · trend), the H layout in light → main chart → other places → "About this data" (collapsed). |
| Type | **Lexend** for everything (300 body, 500 numbers, 600 headings), tabular figures. |
| Change colours | **Green up / red down** (4B). Because red–green is the hardest pair for colour-blind users, every change **must** carry ▲/▼ and a word ("fewer", "below"). This is non-negotiable in components. |
| Chart | Line + soft area + dashed 5-year average (5A), y-axis from 0. |
| Missing data | Hatched column + line break (6A) with a dark callout giving the ONS reason (6D). On screens under 560px the reason moves into the legend so it never covers the line. |
| Headline number | Number + inline trend (7F). The sparkline **draws from start to end** (1.4s, ease-out), then the end dot appears. The main chart draws the same way. |
| Cadence switch | **Monthly / Quarterly** toggle in the chart header, default **Monthly**. It changes the whole page: number, pill, cards, chart ranges (6M·1Y·3Y·5Y·All vs 1Y·3Y·5Y·All) and other places. Monthly local figures are the broader job group, with a banner explaining it; Quarterly is the exact job. The page title always keeps the job the user searched for. |
| Monthly comparisons | Pill, trend and other places compare the last 3 months with the same 3 months a year earlier ("Jun–Aug: 7.0% fewer than a year ago"), so they never contradict each other. |
| Missing figures (S-010, 2026-10-09) | **8A:** a label per cause: **Data not collected** · **Withheld by ONS** · **Not published yet** · **Not found**, each with ONS's reason. **9C:** reason written out in the card and chart callout, ⓘ popover in the numbers table and places list. **10A:** reasons from `pipeline/notices.toml`, checked against the cover sheet on every import. **11D:** estimated months aren't marked on the chart, only tagged in "Show the numbers" and explained in "About this data". |
| Ranking pages (2026-10-10) | `mockups/rankings/rankings-default.png`. Total card, then a table (rank · name · adverts · change · trend), Monthly/Quarterly, sort by Most adverts / Biggest rise / Biggest fall. **10 rows a page by default, 25 as an option.** Sorting, paging and filters live in the URL. On phones the trend word moves under the name. |
| Motion | Ink-in entrance (staggered 80ms) + line drawing. The split-flap is not used for the headline any more. All motion is off under reduced motion. |

### Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#eef1f4` | `#0a0d12` |
| `--surface` | `#ffffff` | `#11161d` |
| `--surface-2` | `#f5f7f9` | `#171d26` |
| `--ink` / `--ink-2` / `--ink-3` | `#0b1220` / `#3b4659` / `#566175` | `#e9edf3` / `#b9c2cf` / `#8f9aab` |
| `--rule` | `#dbe1e8` | `#252d39` |
| `--line` (chart) | `#0b1220` | `#e9edf3` |
| `--up` / `--up-bg` | `#167a3e` / `#ddf2e5` | `#6fdc98` / `#11301d` |
| `--down` / `--down-bg` | `#c0262d` / `#fbe0e1` | `#ff8a8f` / `#3d1516` |
| `--missing` | `#8a94a3` | `#667181` |
| radius | 12px cards · 8px small · 999px chips | |
