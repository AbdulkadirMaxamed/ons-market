# Bugs

Every bug found in the project: what we saw, why it happened, how it was fixed, and what to do differently.
Fixed bugs **stay here** so we can learn from patterns and spot repeats. New bugs get the next `B-###` number.

**Status:** `open` · `fixed` · `workaround` (outside our code; avoided rather than fixed) · `not a bug` (looked like one; kept so nobody chases it again)
**Severity:** `high` (wrong data shown, page broken, data lost) · `medium` (feature broken or misleading) · `low` (cosmetic, tooling, dev-only)

Dates before 2026-10-09 are when the project was set up (2026-10-05 to 2026-10-08); the exact day wasn't recorded.

## Summary

| ID | Title | Area | Severity | Status |
|---|---|---|---|---|
| B-001 | React Router Cloudflare template not found | tooling | low | workaround |
| B-002 | Rolldown native binding missing after install | tooling | low | workaround |
| B-003 | Node version too old for React Router 8 | tooling | low | fixed |
| B-004 | Data files returned 403 in the dev server | web · data loading | high | fixed |
| B-005 | Duplicate-row error named the wrong row | pipeline · importer | medium | fixed |
| B-006 | Shell heredoc mangled a Python patch | tooling | low | fixed |
| B-007 | Headless Chrome phone screenshots wrong | tooling · design | low | workaround |
| B-008 | `brew install uv` failed | tooling | low | workaround |
| B-009 | Monthly change pill contradicted the trend word | web · metrics | high | fixed |
| B-010 | Design collage tiles clipped, badges overlapping | design mockups | low | fixed |
| B-011 | Made-up numbers in a suggestion's example | docs · data rules | high | fixed |
| B-012 | London missing from monthly local comparisons | pipeline · export | medium | fixed |
| B-013 | Chart callout covered the line | web · chart | medium | fixed |
| B-014 | Chart shown at desktop size on phones before JavaScript loaded | web · chart | medium | fixed |
| B-015 | Published date one day early west of the UK | web · dates | medium | fixed |
| B-016 | UK page listed the UK in its own "other places" | web · result page | low | fixed |
| B-017 | Search ranked "Nursery…" first for "nurse" | web · search | medium | fixed |
| B-018 | Search submit cancelled too late | web · search | medium | fixed |
| B-019 | Suggestion list and popovers drawn behind the next block | web · CSS | medium | fixed |
| B-020 | ⓘ popover closed straight away on mouse click | web · popover | medium | fixed |
| B-021 | Server search message wouldn't show after navigating | web · search | low | fixed |
| B-022 | Missing-data collages: wrapped labels, overlapping "est", clipped tiles | design mockups | low | fixed |
| B-023 | Stray line `d kadije` at the end of `.gitignore` | repo | low | fixed |
| B-024 | Read "a" as option A in all four collages | process | medium | fixed |
| B-025 | UK page showed five places instead of six | web · result page | low | fixed |
| B-026 | Hydration warning about `data-scribe-recorder-ready` | web | – | not a bug |
| B-027 | Pager showed "1 2 … 4", hiding a single page behind "…" | web · ranking pages | low | fixed |
| B-028 | Export test expected the wrong latest figure next to a real zero | pipeline · tests | low | fixed |

---

## B-001 · React Router Cloudflare template not found
- **Status:** workaround · **Severity:** low · **Area:** tooling · **Found:** project setup
- **Symptom:** `create-react-router` reported that the "cloudflare" template didn't exist.
- **Cause:** the template moved; React Router's Cloudflare starter now ships through Cloudflare's own CLI.
- **Fix:** scaffolded with `npx create-cloudflare@latest rr --framework=react-router --platform=workers`, which installed React Router 8.4 (v7's successor).
- **Lesson:** check the framework's current docs for the official starter before scaffolding; starters move between tools.

## B-002 · Rolldown native binding missing after install
- **Status:** workaround · **Severity:** low · **Area:** tooling · **Found:** project setup
- **Symptom:** `Cannot find module './rolldown-binding.wasi.cjs'` when starting Vite.
- **Cause:** pnpm skipped the platform-specific optional dependency for the bundler.
- **Fix:** `pnpm install --force`.
- **Lesson:** "native binding missing" after install usually means an optional platform package was skipped; force-reinstall before debugging further.

## B-003 · Node version too old for React Router 8
- **Status:** fixed · **Severity:** low · **Area:** tooling · **Found:** project setup
- **Symptom:** React Router warned that it needs Node newer than 22.22; the shell had 22.11.
- **Fix:** the owner installed Node 22.23.3 with fnm; `.node-version` pins Node 22 for the project.
- **Lesson:** pin the runtime version in the repo on day one.

## B-004 · Data files returned 403 in the dev server
- **Status:** fixed · **Severity:** high · **Area:** web · data loading (`app/lib/data.server.ts`) · **Found:** project setup
- **Symptom:** every `env.ASSETS.fetch` for `/data/*.json` came back 403, so pages had no data.
- **Cause:** the fetch used a made-up host (`https://assets.local/...`); the dev server's asset proxy only accepts the request's own origin.
- **Fix:** resolve the path against the incoming request: `new URL('/data/…', request.url)`.
- **Lesson:** build asset URLs from `request.url`, never a hard-coded host.

## B-005 · Duplicate-row error named the wrong row
- **Status:** fixed · **Severity:** medium · **Area:** pipeline · importer · **Found:** while writing importer tests
- **Symptom:** a duplicate observation in a batch of 50,000 would have been reported as the batch's first row.
- **Cause:** the batch insert fails as a whole, so the error doesn't say which row clashed.
- **Fix:** each batch runs inside a `SAVEPOINT`; on failure it rolls back and replays row by row to name the exact duplicate. Covered by `test_duplicate_rows_fail_without_writing`.
- **Lesson:** an error message pointing at the wrong row is worse than none. Test that error messages name the right thing.

## B-006 · Shell heredoc mangled a Python patch
- **Status:** fixed · **Severity:** low · **Area:** tooling · **Found:** during development
- **Symptom:** a patch script came out broken; `${…}` in the code had been replaced.
- **Cause:** an unquoted heredoc (`<<EOF`) lets the shell expand `$` inside it.
- **Fix:** quoted heredocs (`<<'EOF'`), or patch scripts written to files.
- **Lesson:** always quote heredoc markers when the body contains code.

## B-007 · Headless Chrome phone screenshots wrong
- **Status:** workaround · **Severity:** low · **Area:** tooling · design · **Found:** design review
- **Symptom:** phone screenshots came out about 500px wide, not 390px, and showed animations half-finished.
- **Cause:** headless Chrome has a minimum window width; screenshots are taken on a timer, not after animations.
- **Fix:** render phone views inside 390px iframes; a `#still` URL token turns animation off in mockups.
- **Lesson:** check screenshot widths before judging a layout. See also B-014: an iframe screenshot can also catch a page before its JavaScript has run.

## B-008 · `brew install uv` failed
- **Status:** workaround · **Severity:** low · **Area:** tooling · **Found:** pipeline setup
- **Symptom:** Homebrew tried to build uv from source (LLVM and Rust; macOS 14 is "Tier 3") and hit a stale lock.
- **Fix:** installed with uv's official installer (`curl -LsSf https://astral.sh/uv/install.sh | sh`) into `~/.local/bin`.
- **Lesson:** if Homebrew starts compiling a toolchain, stop and use the vendor's prebuilt installer.

## B-009 · Monthly change pill contradicted the trend word
- **Status:** fixed · **Severity:** high · **Area:** web · metrics · **Found:** design review
- **Symptom:** the headline said "+42.7% on a year ago" while the trend card said "Steady".
- **Cause:** the pill compared a single month; the trend used a smoother measure. ONS warns single-month changes are unreliable.
- **Fix:** Monthly comparisons (pill, trend and other places) all use the last 3 months against the same 3 months a year earlier, falling back to the single month only when one of those months is missing, and the page says which it used. Agreed with the owner; in `CLAUDE.md`.
- **Lesson:** every number on a page must use the same basis, or the page argues with itself.

## B-010 · Design collage tiles clipped, badges overlapping
- **Status:** fixed · **Severity:** low · **Area:** design mockups · **Found:** collage review
- **Symptom:** tiles cut off at the right; letter badges overlapped content.
- **Fix:** widened the page to 1680px and added padding under the badges.
- **Lesson:** look at every rendered image before sending it.

## B-011 · Made-up numbers in a suggestion's example
- **Status:** fixed · **Severity:** high · **Area:** docs · data rules · **Found:** review of `suggestions.md`
- **Symptom:** S-007's example sentence used invented percentages that read like real ONS figures.
- **Cause:** an illustrative example written without labelling it, against the "never fabricate ONS data" rule.
- **Fix:** replaced with "X%" and "Y%" placeholders.
- **Lesson:** examples use real figures from the data or obvious placeholders, never plausible-looking invented ones.

## B-012 · London missing from monthly local comparisons
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** pipeline · export (`pipeline/ons/export.py`) · **Found:** building the result page
- **Symptom:** "Other places" on a local authority's Monthly view never included London.
- **Cause:** ONS reports London as one area at region level (code `TLI`), and the group export kept only `type = 'lad'` places.
- **Fix:** group files include `TLI` along with the local authorities; re-exported.
- **Lesson:** London is a special case in every ONS table (Note 2). Check it explicitly whenever code filters by place type.

## B-013 · Chart callout covered the line
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · chart · **Found:** screenshot review
- **Symptom:** the dark box explaining a gap sat over the data it should help explain.
- **Fix:** the callout sits under the chart with an arrow pointing up at the gap (as in collage 9, which the owner picked).
- **Lesson:** a callout inside the plot needs empty space, and real data rarely leaves any. Put it outside.

## B-014 · Chart shown at desktop size on phones before JavaScript loaded
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · chart (`Chart.tsx`) · **Found:** phone screenshots
- **Symptom:** before JavaScript ran, phones showed a shrunken 720px chart with tiny text and a callout running off screen.
- **Cause:** the server can't know the screen width, so it drew the chart at a guessed 720px; the real width only arrived after hydration.
- **Fix:** the chart measures itself before it's shown (`useLayoutEffect`), staying invisible until then (with a `<noscript>` fallback). The callout is positioned in percentages, so it's right even before measuring.
- **Lesson:** test the page as it looks before JavaScript runs, especially on phones.

## B-015 · Published date one day early west of the UK
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · dates · **Found:** code review
- **Symptom (would have been):** visitors in the Americas would see "Published 24 September 2026", and React would warn about a server/browser mismatch.
- **Cause:** `new Date("2026-09-25")` is midnight UTC, which is still the 24th in negative time zones.
- **Fix:** `dateLabel()` formats the `YYYY-MM-DD` string directly. Tested.
- **Lesson:** never pass a date-only string through `Date` for display.

## B-016 · UK page listed the UK in its own "other places"
- **Status:** fixed (2026-10-09) · **Severity:** low · **Area:** web · result page · **Found:** phone screenshots
- **Symptom:** "Other places" on the UK page started with "United Kingdom".
- **Fix:** the UK page lists regions only.
- **Lesson:** a comparison list must make sense for the biggest area as well as the smallest.

## B-017 · Search ranked "Nursery…" first for "nurse"
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · search (`app/lib/search.ts`) · **Found:** running real queries
- **Symptom:** "nurse" put "Nursery education teaching professionals" above the nursing jobs; "cleaner" put "Window cleaners" above "Cleaners and domestics".
- **Cause:** a plain text prefix ("nurse" ⊂ "nursery") scored as high as a whole word.
- **Fix:** each typed word scores 3 for the word or its plural, 2 for the same stem, 1 for a prefix, plus a bonus when the name starts with it. Tested.
- **Lesson:** test search ranking against a list of real, everyday queries, not only unit cases.

## B-018 · Search submit cancelled too late
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · search (`SearchForm.tsx`) · **Found:** code review
- **Symptom (would have been):** the form could submit twice, or navigate somewhere unexpected.
- **Cause:** `e.preventDefault()` came after an `await`; by then the browser has already handled the submit.
- **Fix:** decide synchronously. If the job list isn't loaded yet, let the form go to the homepage loader, which resolves the search the same way.
- **Lesson:** event cancellation must happen before the first `await`.

## B-019 · Suggestion list and popovers drawn behind the next block
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · CSS (`app.css`) · **Found:** testing in a real browser
- **Symptom:** search suggestions disappeared behind the "Try" links; ⓘ popovers hid behind the next card.
- **Cause:** the ink-in animation used `animation-fill-mode: both`, which keeps its `filter`/`transform` applied after it ends. That makes every animated block its own stacking layer, and later blocks paint over earlier ones whatever their `z-index`.
- **Fix:** `backwards` instead of `both`, so a finished animation leaves nothing behind. The search wrapper also has `relative z-10`.
- **Lesson:** anything that keeps `filter`, `transform` or `opacity < 1` creates a stacking context. Test overlays (lists, popovers) on animated pages in a real browser.

## B-020 · ⓘ popover closed straight away on mouse click
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** web · popover (`InfoTip.tsx`) · **Found:** testing in a real browser
- **Symptom:** clicking ⓘ with a mouse did nothing visible.
- **Cause:** hovering opened it, then the click toggled the same state shut.
- **Fix:** separate states. Hover shows it while the mouse is there; a click or tap pins it open until a click elsewhere, Escape or blur.
- **Lesson:** when hover and click both control one thing, give each its own state.

## B-021 · Server search message wouldn't show after navigating
- **Status:** fixed (2026-10-09) · **Severity:** low · **Area:** web · search · **Found:** code review
- **Symptom (would have been):** after a server-side search failed, the form kept its old state and didn't show the server's message.
- **Cause:** the form copies its starting values into state once, on mount; navigating to the same route doesn't remount it.
- **Fix:** the form is keyed on the URL's query, so a new search result remounts it.
- **Lesson:** state seeded from props won't follow later prop changes. Key the component, or derive the value instead.

## B-022 · Missing-data collages: wrapped labels, overlapping "est", clipped tiles
- **Status:** fixed (2026-10-09) · **Severity:** low · **Area:** design mockups (`mockups/collages/missing-data.html`) · **Found:** collage review
- **Symptom:** period names wrapped onto three lines in collage 9B; "est" overlapped month names in 11C; some tiles cut off their last row.
- **Fix:** no-wrap on period cells, "est" moved inside the plot, tile heights adjusted.
- **Lesson:** same as B-010: look at every image before sending it.

## B-023 · Stray line `d kadije` at the end of `.gitignore`
- **Status:** fixed (2026-10-09, by the owner) · **Severity:** low · **Area:** repo · **Found:** `git status` before a commit
- **Symptom:** an unexpected uncommitted change to `.gitignore`.
- **Fix:** left out of commits and flagged; the owner removed it.
- **Lesson:** read `git diff` on every file before committing, especially ones nobody meant to touch. Never commit a change you didn't make or can't explain.

## B-024 · Read "a" as option A in all four collages
- **Status:** fixed (2026-10-09) · **Severity:** medium · **Area:** process · **Found:** owner's correction
- **Symptom:** after "lets go with a", the decisions for collages 8–11 were all recorded as A. The owner meant only collage 8A.
- **Cause:** a short, ambiguous answer to a question with four parts was read as covering all of them.
- **Fix:** records corrected, the remaining picks asked one question per collage (9C, 10A, 11D), and nothing built had to be undone.
- **Lesson:** when one short answer could cover several open questions, confirm which before recording decisions or building.

## B-025 · UK page showed five places instead of six
- **Status:** fixed (2026-10-09) · **Severity:** low · **Area:** web · result page (`market.server.ts`) · **Found:** writing `bugs.md`
- **Symptom:** "Other places" on the UK page had five rows; every other page has six.
- **Cause:** one row was always reserved for the place itself, which the UK page leaves out (B-016).
- **Fix:** reserve the row only when the place is listed. Tested.
- **Lesson:** when you special-case one item, check the counts and limits around it.

## B-026 · Hydration warning about `data-scribe-recorder-ready`
- **Status:** not a bug · **Area:** web · **Found:** browser console during testing (2026-10-09)
- **Symptom:** React warned that the server HTML didn't match, pointing at a `data-scribe-recorder-ready` attribute on `<html>`.
- **Cause:** a browser extension adds that attribute before React loads. The site never sets it.
- **Lesson:** before chasing a hydration warning, check whether the differing attribute is ours. Test in a clean profile to be sure.

## B-027 · Pager showed "1 2 … 4", hiding a single page behind "…"
- **Status:** fixed (2026-10-10) · **Severity:** low · **Area:** web · ranking pages (`app/lib/rankings.ts`) · **Found:** screenshot review
- **Symptom:** with four pages, the pager read "1 2 … 4", so page 3 was hidden behind "…".
- **Cause:** any gap between page numbers became "…", including a gap of exactly one page.
- **Fix:** a one-page gap shows that page number; "…" only stands in for two or more pages. Tested.
- **Lesson:** "…" should never take the same space as the one thing it hides. Check the small cases (1–5 pages) as well as the big ones.

## B-028 · Export test expected the wrong latest figure next to a real zero
- **Status:** fixed (2026-10-10) · **Severity:** low · **Area:** pipeline · tests (`test_export.py`) · **Found:** test run
- **Symptom:** a new test expected Manchester's latest monthly figure to be 50 (January); the export said 0 (February) and the test failed.
- **Cause:** the test was wrong, not the code. The test workbook has a real zero in February, and a zero is a figure, so February is the latest month.
- **Fix:** corrected the test and added a comment saying why.
- **Lesson:** the "zeros are values, never gaps" rule applies when writing tests too. When a test fails, check the expectation against the data rules before changing the code.
