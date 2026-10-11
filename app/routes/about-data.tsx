import { data } from "react-router";

import type { Route } from "./+types/about-data";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard, type Meta } from "~/lib/data.server";
import { dateLabel, MIN_VOLUME, periodLabel, TREND, TREND_THRESHOLD } from "~/lib/format";
import { LABEL, NOTICE_LABEL, noticePeriods, noticesByKind, sourceOf } from "~/lib/missing";

/**
 * Methodology, caveats and this release's ONS notices (features.md, Phase 5). Facts come from the workbook's cover
 * sheet and notes (docs/03-workbook.md); the rules match pipeline/ons/metrics.py. Notices are read from meta.json, so
 * the page follows each release without edits.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const meta = await loadShard<Meta>(request, "meta.json");
  if (!meta) throw data("Not found", { status: 404 });
  return {
    release: {
      label: meta.releaseLabel,
      published: dateLabel(meta.publishedOn),
      latestMonth: periodLabel(meta.latestMonth, "long"),
      latestQuarter: periodLabel(meta.latestQuarter, "long"),
    },
    groups: noticesByKind(meta.notices),
  };
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About the data | Is the market cooked?" },
    {
      name: "description",
      content:
        "Where our online job-advert figures come from, how we compare them, why some are missing, and what they can’t tell you.",
    },
  ];
}

const SECTIONS = [
  ["source", "Where it comes from"],
  ["measures", "What we show"],
  ["method", "How we compare figures"],
  ["missing", "Missing and estimated figures"],
  ["notices", "ONS notices for this release"],
  ["limits", "What it can’t tell you"],
  ["licence", "Licence and credit"],
] as const;

const b = "font-medium text-ink";

export default function AboutData({ loaderData }: Route.ComponentProps) {
  const { release, groups } = loaderData;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8 md:py-14">
        <article className="grid max-w-[68ch] gap-9 text-[17px] text-ink-2 [&_h2]:mb-2.5 [&_h2]:scroll-mt-6 [&_h2]:text-xl [&_h2]:text-ink [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:text-[17px] [&_h3]:text-ink">
          <header className="ink-in" style={{ "--i": 0 } as React.CSSProperties}>
            <h1 className="text-[clamp(30px,4.4vw,42px)] leading-tight tracking-[-0.025em] text-ink">About the data</h1>
            <p className="mt-3">
              Every figure on this site comes from the Office for National Statistics (ONS). We don’t estimate, adjust
              or fill in anything ourselves. Where ONS has no figure, we say so and explain why.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-rule bg-surface px-5 py-4 text-[14.5px] sm:grid-cols-4">
              {[
                ["Release", release.label],
                ["Published", release.published],
                ["Latest month", release.latestMonth],
                ["Latest quarter", release.latestQuarter],
              ].map(([dt, dd]) => (
                <div key={dt}>
                  <dt className="text-[12.5px] text-ink-3">{dt}</dt>
                  <dd className="mt-0.5 text-ink">{dd}</dd>
                </div>
              ))}
            </dl>
          </header>

          <nav aria-label="On this page" className="ink-in text-[15px]" style={{ "--i": 1 } as React.CSSProperties}>
            <p className="mb-1.5 text-[13px] text-ink-3">On this page</p>
            <ol className="grid list-decimal gap-1 pl-5">
              {SECTIONS.map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`} className="underline-offset-2 hover:underline">
                    {title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <section aria-labelledby="source">
            <h2 id="source">Where it comes from</h2>
            <p>
              The ONS publishes <em>Labour demand volumes by Standard Occupation Classification (SOC 2020), UK</em>{" "}
              every month. It counts online job adverts collected by Textkernel from around 90,000 job boards and
              recruitment sites, sorted by ONS into jobs (SOC 2020 codes) and places. ONS removes duplicate adverts it
              can detect, such as the same job posted on several boards.
            </p>
            <p className="mt-3">
              These are <strong className={b}>official statistics in development</strong>: ONS is still testing and
              improving them, so methods can change. Each new release can also revise earlier months, and we always show
              the latest version.
            </p>
          </section>

          <section aria-labelledby="measures">
            <h2 id="measures">What we show</h2>
            <p>
              <strong className={b}>New online job adverts</strong>: adverts that appeared online for the first time in a
              month or quarter. Not jobs filled, and not every job on offer.
            </p>
            <p className="mt-3">
              Jobs follow ONS’s classification (SOC 2020). We use shorter everyday names, such as “Software developers”
              for ONS’s “Programmers and software development professionals”; the official name and code are always
              shown under the heading.
            </p>
            <h3>Monthly and Quarterly</h3>
            <p>ONS publishes different detail at different levels, so every page has a Monthly and a Quarterly view:</p>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5">
              <li>
                <strong className={b}>The UK and its 12 regions</strong>: monthly figures for each exact job.
              </li>
              <li>
                <strong className={b}>Local areas</strong> (328 local authorities on 2023 boundaries, plus London):
                monthly figures for broad job groups only, for example “IT professionals”, and quarterly figures for
                each exact job. So for a local area, Monthly shows the broader group, with a note saying so, and
                Quarterly shows the exact job.
              </li>
              <li>
                <strong className={b}>London</strong> is a single area. ONS doesn’t split it into boroughs.
              </li>
              <li>
                <strong className={b}>Quarterly figures for the UK and regions</strong> are the three monthly ONS figures
                added together. If any of the three months is missing, so is the quarter.
              </li>
            </ul>
            <p className="mt-3">
              Monthly is the default because it’s more up to date. Quarterly is more precise for a local area, but
              arrives later.
            </p>
          </section>

          <section aria-labelledby="method">
            <h2 id="method">How we compare figures</h2>
            <p>
              Adverts rise and fall with the seasons, so we compare with <strong className={b}>the same time a year
              earlier</strong>, never with the month before.
            </p>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5">
              <li>
                <strong className={b}>Monthly</strong>: the latest 3 months added together, against the same 3 months a
                year earlier. ONS advises against reading too much into single months. If any of those six months is
                missing, we compare the single latest month with the same month a year earlier instead.
              </li>
              <li>
                <strong className={b}>Quarterly</strong>: the latest quarter against the same quarter a year earlier.
              </li>
              <li>
                <strong className={b}>Small numbers</strong>: both sides need an average of at least {MIN_VOLUME}{" "}
                adverts a period: {MIN_VOLUME} for a single month or quarter, {MIN_VOLUME * 3} for a 3-month total.
                Below that we show “too few” instead of a percentage, because a handful of adverts can swing it wildly.
                A 3-month total that’s too small stays “too few”; we don’t fall back to a single month to get a
                percentage. We never give a
                percentage against a missing figure or zero.
              </li>
            </ul>

            <h3>Trend words</h3>
            <p>Our reading of the change on a year earlier. ONS doesn’t publish these.</p>
            <dl className="mt-2 grid gap-1.5 text-[16px] sm:grid-cols-[auto_1fr] sm:gap-x-5">
              {[
                [TREND.up, `up ${TREND_THRESHOLD}% or more`],
                [TREND.flat, `within ${TREND_THRESHOLD}% either way`],
                [TREND.down, `down ${TREND_THRESHOLD}% or more`],
                [TREND.small, `fewer than ${MIN_VOLUME} adverts a month to compare`],
                [TREND.na, "no figure from a year earlier to compare with"],
              ].map(([t, text]) => {
                const { icon, word, tone } = t as (typeof TREND)[string];
                return (
                  <div key={word} className="contents">
                    <dt className={`font-medium ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "flat" ? "text-flat" : "text-ink-3"}`}>
                      <span aria-hidden="true">{icon}</span> {word}
                    </dt>
                    <dd className="mb-1.5 sm:mb-0">{text as string}</dd>
                  </div>
                );
              })}
            </dl>

            <h3>Other figures</h3>
            <ul className="grid list-disc gap-1.5 pl-5">
              <li>
                <strong className={b}>Latest figure</strong>: the newest period with a figure. If ONS withheld the newest
                one, we show the one before it and say which period it is.
              </li>
              <li>
                <strong className={b}>5-year average</strong>: the average over the last 5 years (60 months or 20
                quarters). Missing periods are skipped, not counted as zero, and we only show the average when at least
                three-quarters of those periods have a figure.
              </li>
              <li>
                <strong className={b}>Rankings</strong>: “Most adverts” lists every place or job, with missing figures
                at the end. “Biggest rise” and “Biggest fall” only include those with a percentage, so ones with too few
                adverts are left out.
              </li>
              <li>
                <strong className={b}>Rising and falling fastest</strong> on the homepage: UK jobs with at least 1,500
                adverts in the same 3 months a year earlier, so small jobs don’t crowd the list.
              </li>
              <li>
                Adverts ONS couldn’t match to a job are counted in totals but left out of search and rankings.
              </li>
            </ul>
          </section>

          <section aria-labelledby="missing">
            <h2 id="missing">Missing and estimated figures</h2>
            <p>
              A gap is <strong className={b}>never zero</strong>. Real zeros exist in the data (no adverts that period),
              and we show those as 0. When there’s no figure, we label why:
            </p>
            <dl className="mt-3 grid gap-3">
              {(
                [
                  [LABEL.not_collected, "ONS couldn’t get the advert data at all, so there’s no figure for anything that period."],
                  [LABEL.withheld, "ONS has the data but held this figure back because it doesn’t trust it, usually after a data source dropped out."],
                  [LABEL.unpublished, "The period hasn’t been published yet, for example a quarter that’s still under way."],
                  [LABEL.not_found, "ONS doesn’t publish this job for this place at all."],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <dt>
                    <span className="inline-flex rounded-full border border-dashed border-missing bg-surface-2 px-2.5 py-0.5 text-[13.5px] font-medium text-ink-2">
                      {label}
                    </span>
                  </dt>
                  <dd className="mt-1">{text}</dd>
                </div>
              ))}
              <div>
                <dt>
                  <span className="inline-flex rounded-full border border-est-rule bg-est-bg px-2.5 py-0.5 text-[13.5px] font-medium text-est">
                    Partly estimated
                  </span>
                </dt>
                <dd className="mt-1">
                  The figure exists, but ONS partly estimated it to make up for a faulty source. We use it like any other
                  figure and don’t mark it on the charts; it’s tagged in “Show the numbers” under each chart. Odd jumps
                  from one month to the next in these periods are more likely to come from the estimate than from the job
                  market.
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="notices">
            <h2 id="notices">ONS notices for this release</h2>
            <p>
              ONS lists every known problem on the workbook’s cover sheet. Below is each one, with our short summary and
              ONS’s own wording. We check this list on every import: if ONS adds a problem we haven’t explained, the
              update stops until we have.
            </p>
            {groups.map((g) => (
              <div key={g.kind}>
                <h3>{NOTICE_LABEL[g.kind]}</h3>
                <ul className="grid gap-2.5">
                  {g.notices.map((n) => (
                    <li key={n.heading} className="rounded-lg border border-rule bg-surface px-4 py-3 text-[15px]">
                      <p className="font-medium text-ink">{sourceOf(n).replace(/^ONS, data issue: /, "")}</p>
                      <p className="mt-1">{n.reason}</p>
                      <p className="mt-1 text-[13.5px] text-ink-3">{noticePeriods(n)}</p>
                      <details className="mt-1.5 text-[14px]">
                        <summary className="cursor-pointer text-ink-3">ONS’s wording</summary>
                        <blockquote className="mt-2 border-l-2 border-rule pl-3 whitespace-pre-line">
                          “{n.ons}”
                          <footer className="mt-1 text-[12.5px] text-ink-3">
                            {n.heading}, ONS workbook published {release.published}
                          </footer>
                        </blockquote>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section aria-labelledby="limits">
            <h2 id="limits">What it can’t tell you</h2>
            <ul className="grid list-disc gap-2 pl-5">
              <li>An advert isn’t the same as a job. ONS removes the duplicates it can detect, but some roles are still advertised more than once.</li>
              <li>Some jobs are never advertised online, for example work found by word of mouth or filled internally.</li>
              <li>It doesn’t say how many people applied, so it can’t tell you how competitive a job is.</li>
              <li>
                ONS says short-term changes since November 2025 are less reliable, because of the estimated periods
                above. Look at longer periods, which is why we compare 3 months at a time.
              </li>
            </ul>
          </section>

          <section aria-labelledby="licence">
            <h2 id="licence">Licence and credit</h2>
            <p>
              Source: Office for National Statistics, licensed under the{" "}
              <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" className="underline underline-offset-2">
                Open Government Licence v3.0
              </a>
              . Trend words, averages, rankings and the summaries above are our own reading of the ONS figures, not ONS
              measures, and ONS doesn’t endorse this site.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
