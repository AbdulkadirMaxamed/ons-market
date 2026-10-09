import type { Route } from "./+types/about-data";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "About the data | Is the market cooked?" },
    {
      name: "description",
      content: "Where our job-advert figures come from, what they measure, and what they can’t tell you.",
    },
  ];
}

// Facts here come from the ONS workbook's cover sheet and notes (docs/03-workbook.md).
export default function AboutData() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8 md:py-14">
        <article className="grid max-w-[68ch] gap-8 text-[17px] text-ink-2 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:text-ink">
          <header>
            <h1 className="text-[clamp(30px,4.4vw,42px)] leading-tight tracking-[-0.025em] text-ink">About the data</h1>
            <p className="mt-3">
              Every figure on this site comes from the Office for National Statistics (ONS). We don’t estimate, adjust
              or fill in anything ourselves.
            </p>
          </header>

          <section>
            <h2>Where it comes from</h2>
            <p>
              The ONS publishes <em>Labour demand volumes by Standard Occupation Classification (SOC 2020), UK</em>{" "}
              every month. It counts online job adverts collected by Textkernel from around 90,000 job boards and
              recruitment sites. These are official statistics in development, which means the ONS is still testing
              and improving them.
            </p>
          </section>

          <section>
            <h2>What we show</h2>
            <p>
              <strong className="font-medium text-ink">New online job adverts</strong>: adverts that appeared online
              for the first time in a month or quarter. For a local area, the ONS only publishes monthly figures for
              broad job groups (for example IT professionals), so our Monthly view shows that broader group. Switch to
              Quarterly to see the exact job.
            </p>
          </section>

          <section>
            <h2>What it can’t tell you</h2>
            <ul className="grid list-disc gap-2 pl-5">
              <li>An advert isn’t the same as a job. The ONS removes duplicate adverts it can detect, but some roles are still advertised more than once.</li>
              <li>Some jobs are never advertised online, for example work found by word of mouth.</li>
              <li>A gap in a chart means the ONS has no reliable figure for that period. It never means zero adverts.</li>
              <li>The ONS says short-term changes since November 2025 are less reliable, so we compare longer periods.</li>
            </ul>
          </section>

          <section>
            <h2>Our interpretation</h2>
            <p>
              Trend words (Growing, Steady, Shrinking) and averages are our reading of the ONS figures, not an ONS
              measure. We call something Growing or Shrinking when adverts are up or down by 10% or more on a year
              earlier, and we don’t call a trend when there are fewer than 30 adverts to compare.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
