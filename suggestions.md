# Suggestions

Ideas waiting for approval. Approved ones move to `features.md`; rejected ones stay here so they aren't suggested again.
Status: `pending` · `approved` · `rejected`

---

### S-001 · Automated release check and import
**Status:** approved 2026-10-08 → moved to `features.md`
A scheduled GitHub Action (daily) runs the same importer: it checks the ONS dataset page for a newer workbook, downloads it, imports it, exports shards and deploys. If nothing is new it exits; if the import fails, nothing is deployed.
**Why:** removes the monthly manual step. Costs nothing on GitHub's free tier.
**Needs:** confirming ONS's download URL pattern; storing the archive somewhere other than your laptop (GitHub Releases).

### S-002 · Combined areas (Greater Manchester, West Yorkshire…)
**Status:** approved 2026-10-08 → moved to `features.md`
Build city-region totals by adding up their local authorities, using ONS's own lookup in Table 6. If any part is suppressed, the total is missing.
**Why:** people say "Manchester" and mean the city region. 1,362 adverts for software developers in Manchester (the council area) undercounts the city region, because Salford, Trafford and others are separate.

### S-003 · Friendly job names and aliases
**Status:** approved 2026-10-08 → moved to `features.md`
A hand-curated list mapping everyday terms ("software engineer", "programmer", "dev", "nurse", "sparky") to SOC codes, plus short display names ("Software developers" for "Programmers and software development professionals"). Shorter URLs come with it.
**Why:** official SOC names are long and unfamiliar, and search is the whole front door.

### S-004 · Shareable result cards
**Status:** approved 2026-10-08 → moved to `features.md`
A "Share" button that copies a one-line summary ("Software developer adverts in Manchester: 1,362 in Apr–Jun 2026, down 18.6% on a year ago. Source: ONS") and an auto-generated social image (Open Graph) for each result page.
**Why:** the product exists to settle arguments. Make the evidence easy to post into one.

### S-005 · Compare two places or two jobs
**Status:** approved 2026-10-08 → moved to `features.md`
`/compare?…`: two series on one chart, side-by-side figures.
**Why:** "Should I move to Leeds?" and "Is data analysis better than software?" are natural next questions.

### S-006 · Monthly 3-digit local view
**Status:** rejected 2026-10-08. Superseded: monthly local figures for the broader job group are now the default Monthly view of the result page, so a separate panel is not needed.
Use Table 4 (local authority × 3-digit SOC, monthly) as an extra "broader job, fresher data" panel on local result pages.
**Why:** local quarterly data lags 2–3 months; this offers a fresher, broader signal. Adds about 4M rows to the local DB (none deployed beyond shards).

### S-007 · Share of all adverts
**Status:** approved 2026-10-08 → moved to `features.md`
Show this job's share of all adverts in the area, and how that has changed ("Software developers were X% of Manchester adverts, down from Y% in 2022", with real figures computed at export).
**Why:** separates "this job is shrinking" from "everything is shrinking". Uses Table 2 totals we already import.

### S-008 · "Cooked meter" brand voice for the trend word
**Status:** approved 2026-10-08 → moved to `features.md`
Map the transparent trend rule onto the brand: Growing = "Not cooked", Steady = "Simmering", Shrinking = "Cooked", always shown next to the plain word and the number behind it. Shown as an option in the "Kitchen" mockup direction.
**Why:** it gives the domain name a payoff and makes the verdict memorable. The risk is it feels flippant, hence a suggestion rather than the default.

### S-009 · Ticker-triangle logo and favicon
**Status:** approved 2026-10-08 (requested by owner) → moved to `features.md`
Use the ▲▼ ticker mark from the design as the site logo and as the browser-tab icon (SVG favicon, with a PNG fallback and Apple touch icon).

### S-010 · Explain every missing or estimated figure with ONS's reason
**Status:** approved 2026-10-09 (requested by owner). Picked **8A · 9C · 10A · 11D** from `mockups/collages/collage-8…11` → moved to `features.md`
- **Labels (8A):** one per cause: "Data not collected" (only when ONS couldn't get the data, e.g. March 2026), "Withheld by ONS" (collected but withheld over quality), "Not published yet", "Not found" (ONS publishes no figure for this job in this place).
- **Helper (9C, mix):** the reason is written out in the "Last month/quarter" card and the chart callout; in the numbers table and the places list, an ⓘ next to the label opens a popover with the reason and the ONS source ("ONS, Data issue – March 2026"). The popover works on tap, hover and keyboard.
- **Source (10A):** each import saves ONS's own "Data issue" paragraphs from the cover sheet. `pipeline/notices.toml` maps each heading to its months/quarters, a cause and a short reason. A heading that isn't mapped stops the import, so a gap can never appear without a reason. "About this data" quotes ONS word for word.
- **Estimated months (11D):** the chart is unchanged. Partly estimated months get a "Partly estimated ⓘ" tag in "Show the numbers", and "About this data" explains them.
**Why:** a gap with no explanation looks like a broken site or, worse, like zero adverts. Using ONS's own reasons keeps the site honest and trusted.

### S-011 · "Growing now" tab: the fields gaining adverts, and where
**Status:** pending (requested by owner 2026-10-11; owner will add more detail)
A tab or page showing which areas of work are gaining online job adverts right now, by percentage, with the 3 places advertising most for each. The name must not be "hottest role"; options: "Growing now", "On the rise", "Where the growth is".
- **What counts as "an area of work":** ONS publishes jobs (SOC 2020 occupations), not industries. Software developers in a bank and in a games studio count as one job. So the closest fit is the **job group** (3-digit SOC, 104 groups, e.g. "IT professionals"), with an option to open it up into its exact jobs (412). We'd say "job group", not "industry", to stay accurate.
- **Growth:** the last 3 months against the same 3 months a year earlier (UK, Monthly), using the same rules as the rest of the site: 90+ adverts on each side, no percentage against a gap or zero, plus a minimum size (like the homepage's 1,500) so tiny groups can't top the list.
- **3 places hiring most:** for each group, the 3 places with the most adverts over the same 3 months, each with its own % change. Groups have monthly figures for every local authority (Table 4), so this can be towns and cities, not just regions. For an exact job it would be regions (Table 3), or local areas a quarter behind (Table 5).
- **Example layout:** "IT professionals ▲ 14.2% · Jun–Aug 2026 · 18,400 adverts · most in London (6,100 ▲9%), Manchester (1,540 ▲21%), Leeds (900 ▲12%)". All figures here are made up for illustration; real ones are computed at export.
- **Builds on:** the homepage's "Rising fastest" list (exact jobs, UK only), which this extends with groups and places. A "Shrinking now" side comes free.
**Why:** answers "what's actually hiring right now, and where?", the question behind "is the market cooked?".

### S-012 · Filter by skill level and type of work (trades, professional, elementary…)
**Status:** pending (requested by owner 2026-10-11)
Filters across the site: search, ranking pages, "Rising fastest" and S-011. For example "Skilled trades only" or "Higher-skill jobs".
- **What the workbook gives us:** only SOC 2020 codes and names, with no skill column (`docs/03-workbook.md`). But the SOC code itself carries the grouping: its **first digit is the major group**, and ONS's SOC 2020 manual gives each major group a skill level. So the filters come from ONS's own classification, not our judgement.
- **Type of work (9 major groups):** 1 Managers, directors and senior officials · 2 Professional · 3 Associate professional and technical · 4 Administrative and secretarial · 5 **Skilled trades** · 6 Caring, leisure and other service · 7 Sales and customer service · 8 Process, plant and machine operatives · 9 Elementary.
- **Skill level (4 levels, as SOC 2020 Volume 1 assigns them):** level 4 (degree-level: professional and senior manager jobs), level 3 (e.g. associate professional and skilled trades), level 2 (e.g. admin, caring, sales, operatives), level 1 (elementary). Plain labels on the site, e.g. "Degree-level", "Technical and trade", "Intermediate", "Entry-level". **To verify against the SOC 2020 manual before building** (major group 1 is split between levels 3 and 4).
- **Finer cuts:** the 2-digit sub-major groups (about 25, e.g. "Skilled construction and building trades", "Health professionals") could be a second filter level.
- **How:** a small lookup table in the pipeline (code prefix → group, level), exported in `search.json`; filters live in the URL like the existing sort and region filters, so they work without JavaScript and can be shared.
**Why:** "is the market cooked for trades?" and "for graduates?" are different questions with different answers. Grouping by ONS's own classification makes them answerable without inventing categories.
