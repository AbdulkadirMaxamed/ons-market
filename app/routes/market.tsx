import { useState } from "react";
import { data, Link, redirect, useSearchParams, type ShouldRevalidateFunctionArgs } from "react-router";

import type { Route } from "./+types/market";
import { Chart } from "~/components/market/Chart";
import { EstimatedTag, MissingTag } from "~/components/market/MissingTag";
import { Sparkline } from "~/components/market/Sparkline";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard } from "~/lib/data.server";
import type { GroupShard, Meta, OccupationShard, SearchIndex } from "~/lib/data.server";
import {
  ARROW,
  dateLabel,
  direction,
  fmt,
  fmtPct,
  inSentence,
  MIN_VOLUME,
  nextPeriod,
  periodLabel,
  periodsBetween,
  sentenceCase,
  TREND,
  windowLabel,
} from "~/lib/format";
import { marketViews, placeName, type Cadence, type View } from "~/lib/market.server";
import { jobBySlug } from "~/lib/search";
import { estimatedFor, missingFor, notFound, sourceOf, unpublished } from "~/lib/missing";
import type { Change, Notice } from "~/lib/types";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [index, meta] = await Promise.all([
    loadShard<SearchIndex>(request, "search.json"),
    loadShard<Meta>(request, "meta.json"),
  ]);
  const found = index && jobBySlug(index.occupations, params.occupation);
  const place = index?.places.find((p) => p.slug === params.location);
  if (!index || !meta || !found || !place) throw data("Not found", { status: 404 });
  const occ = found.job;
  if (found.moved) throw redirect(`/market/${occ.slug}/${place.slug}${new URL(request.url).search}`, 301);

  const [occupation, group] = await Promise.all([
    loadShard<OccupationShard>(request, `occupation/${occ.soc}.json`),
    place.type === "lad" ? loadShard<GroupShard>(request, `group/${occ.group}.json`) : null,
  ]);
  if (!occupation) throw data("Not found", { status: 404 });

  const region = place.region ? index.places.find((p) => p.code === place.region) : undefined;
  return {
    job: { code: occ.soc, name: occ.name, ons: occupation.ons ?? occ.name, slug: occ.slug },
    place: { code: place.code, name: placeName(place), slug: place.slug, type: place.type, region: region && placeName(region) },
    views: marketViews(occupation, group, index, place),
    notices: meta.notices,
    release: { publishedOn: meta.publishedOn, latestMonth: meta.latestMonth, latestQuarter: meta.latestQuarter },
  };
}

// Switching Monthly/Quarterly only changes ?view=, and the loader already sent both views.
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found | Is the market cooked?" }];
  const { job, place, views } = loaderData;
  const q = views.Q?.m;
  const description = q
    ? `Latest ONS online job-advert data for ${inSentence(job.name)} in ${place.name}: ${fmt(q.latest.value)} new adverts in ${periodLabel(q.latest.period)}.`
    : `ONS online job-advert data for ${inSentence(job.name)} in ${place.name}.`;
  return [
    { title: `${job.name} job market in ${place.name} | Is the market cooked?` },
    { name: "description", content: description },
  ];
}

const RANGES: Record<Cadence, { key: string; take: number }[]> = {
  M: [
    { key: "6M", take: 6 },
    { key: "1Y", take: 12 },
    { key: "3Y", take: 36 },
    { key: "5Y", take: 60 },
    { key: "All", take: Infinity },
  ],
  Q: [
    { key: "1Y", take: 4 },
    { key: "3Y", take: 12 },
    { key: "5Y", take: 20 },
    { key: "All", take: Infinity },
  ],
};
const DEFAULT_RANGE: Record<Cadence, string> = { M: "1Y", Q: "3Y" };

const ink = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function Market({ loaderData }: Route.ComponentProps) {
  const { job, place, views, notices, release } = loaderData;
  const [params, setParams] = useSearchParams();
  const asked: Cadence = params.get("view") === "quarterly" ? "Q" : "M";
  const cadence: Cadence = views[asked] ? asked : asked === "M" ? "Q" : "M";
  const v = views[cadence];

  const setCadence = (c: Cadence) =>
    setParams(
      (p) => {
        if (c === "Q") p.set("view", "quarterly");
        else p.delete("view");
        return p;
      },
      { replace: true, preventScrollReset: true },
    );

  const header = (
    <SiteHeader>
      <Link
        to="/"
        className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-rule bg-surface-2 px-3.5 text-sm"
        aria-label="Change search"
      >
        <span className="truncate">
          {job.name} · {place.name}
        </span>
        <span aria-hidden="true">✎</span>
      </Link>
    </SiteHeader>
  );

  if (!v) {
    const nf = notFound(job.name, place.name);
    return (
      <>
        {header}
        <main className="mx-auto max-w-[1040px] px-4 py-10 md:px-8">
          <h1 className="text-[clamp(26px,4vw,38px)] leading-[1.1] tracking-[-0.025em]">
            {job.name} in {place.name}
          </h1>
          <div className="mt-6 grid max-w-[60ch] gap-3 rounded-card border border-rule bg-surface p-5">
            <MissingTag missing={nf} written />
            <p className="text-ink-2">
              Try a nearby area, the wider region, or{" "}
              <Link to="/" className="underline">
                another search
              </Link>
              .
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      {header}
      <main className="mx-auto max-w-[1040px] px-4 md:px-8">
        <Heading job={job} place={place} view={v} other={views[cadence === "M" ? "Q" : "M"] != null} asked={asked} notices={notices} />
        {v.m ? (
          <Result key={cadence} job={job} place={place} view={v} notices={notices} release={release} setCadence={setCadence} hasOther={{ M: !!views.M, Q: !!views.Q }} />
        ) : (
          <div className="mt-4 rounded-card border border-rule bg-surface p-5">
            <MissingTag missing={missingFor(v.span.end, notices)} written />
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Heading({
  job,
  place,
  view,
  other,
  asked,
  notices,
}: {
  job: { code: string; name: string; ons: string };
  place: { name: string; region?: string; type: string };
  view: View;
  other: boolean;
  asked: Cadence;
  notices: Notice[];
}) {
  const m = view.m;
  const series = view.broader ? sentenceCase(view.job.name) : view.job.name;
  return (
    <section className="ink-in pt-7 pb-4" style={ink(0)}>
      <h1 className="text-[clamp(26px,4vw,38px)] leading-[1.1] tracking-[-0.025em]">
        {job.name} in {place.name}
      </h1>
      <p className="mt-1.5 text-[14.5px] text-ink-3">
        {/* The subtitle carries ONS's official name, so a friendly short name never hides what's being counted. */}
        {view.broader ? series : job.ons} · SOC {view.job.code} · {place.name}
        {place.region ? `, ${place.region}` : ""}
      </p>
      {view.cadence !== asked && (
        <Banner>
          <span className="mr-1.5">
            No {asked === "M" ? "monthly" : "quarterly"} figures for this job here, so this shows{" "}
            {view.cadence === "M" ? "monthly" : "quarterly"} ones.
          </span>
          <MissingTag missing={notFound(job.name, place.name)} info align="left" />
        </Banner>
      )}
      {view.broader && (
        <Banner>
          Monthly figures for {place.name} only exist for broader job groups, so this shows{" "}
          <b className="font-medium">{inSentence(series)}</b> (SOC {view.job.code}), which includes{" "}
          {inSentence(job.name)}.{" "}
          {other ? (
            <>
              Switch to <b className="font-medium">Quarterly</b> on the chart for {inSentence(job.name)} only.
            </>
          ) : null}
        </Banner>
      )}
      {view.derived && (
        <Banner>
          ONS publishes {place.type === "uk" ? "UK" : "regional"} figures by month. Each quarter here adds up its three
          months; if ONS has no figure for any of them, the quarter has none either.
        </Banner>
      )}
      {m && m.newest !== m.latest.period && (
        <Banner>
          <span className="mr-1.5">
            No figure for {periodLabel(m.newest, "long")}, so this shows {periodLabel(m.latest.period, "long")}.
          </span>
          <MissingTag missing={missingFor(m.newest, notices)} info align="left" />
        </Banner>
      )}
    </section>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3.5 max-w-[72ch] rounded-lg border border-rule bg-surface px-3.5 py-3 text-[14.5px] text-ink-2">
      {children}
    </p>
  );
}

function Result({
  job,
  place,
  view,
  notices,
  release,
  setCadence,
  hasOther,
}: {
  job: { name: string; slug: string };
  place: { name: string; slug: string };
  view: View;
  notices: Notice[];
  release: { publishedOn: string; latestMonth: string; latestQuarter: string };
  setCadence: (c: Cadence) => void;
  hasOther: Record<Cadence, boolean>;
}) {
  const m = view.m!;
  const unit = view.cadence === "M" ? "month" : "quarter";
  const periods = periodsBetween(view.span.start, view.span.end);
  const [range, setRange] = useState(DEFAULT_RANGE[view.cadence]);
  const [showTable, setShowTable] = useState(false);
  const [showRule, setShowRule] = useState(false);

  const take = RANGES[view.cadence].find((r) => r.key === range)!.take;
  const from = Math.max(0, periods.length - take);
  const shownP = periods.slice(from);
  const shownV = view.values.slice(from);
  const spark = view.values.slice(-(view.cadence === "M" ? 24 : 12));
  const sparkFrom = periods[periods.length - spark.length];

  const head = m.basis === "roll" && m.roll ? m.roll : m.yoy;
  const nextQuarter = view.cadence === "Q" ? nextPeriod(view.span.end) : null;
  const quarterOfLatestMonth = `${release.latestMonth.slice(0, 4)}-Q${Math.ceil(Number(release.latestMonth.slice(5)) / 3)}`;
  const showUnpublished = nextQuarter != null && nextQuarter === quarterOfLatestMonth;
  const what = view.broader ? inSentence(sentenceCase(view.job.name)) : inSentence(job.name);

  return (
    <>
      {/* Hero: number + change + drawing sparkline (3B, 7F) */}
      <section
        aria-label="Headline"
        className="ink-in grid gap-[18px] rounded-card border border-rule bg-surface p-[22px] md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-center md:px-8 md:py-7"
        style={ink(1)}
      >
        <div>
          <p className="text-[clamp(64px,13vw,104px)] leading-[0.95] font-medium tracking-[-0.045em] tabular-nums">
            {fmt(m.latest.value)}
          </p>
          <p className="mt-2 text-[15.5px] text-ink-2">
            new online job adverts{view.broader ? ` for ${what}` : ""} · {periodLabel(m.latest.period, "long")}
          </p>
          <HeroChip head={head} m={m} />
        </div>
        <div className="grid gap-1.5">
          <Sparkline values={spark} />
          <div className="flex justify-between text-[12.5px] text-ink-3">
            <span>{periodLabel(sparkFrom)}</span>
            <span>{periodLabel(periods[periods.length - 1])}</span>
          </div>
        </div>
      </section>

      {/* Three cards: 5-year average · last period · trend */}
      <section aria-label="Comparisons" className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Card i={2} label="5-year average">
          <CardValue change={m.avg5y} words={["above", "below"]} />
          <span className="text-[13px] text-ink-3">
            {m.avg5y.value != null
              ? `Average ${fmt(m.avg5y.value)} a ${unit}`
              : `Needs figures for most of the last 5 years`}
          </span>
        </Card>
        <Card i={3} label={`Last ${unit}`}>
          {m.prev.s === "missing" && m.prev.period ? (
            <>
              <MissingTag missing={missingFor(m.prev.period, notices)} written />
              <span className="text-[13px] text-ink-3">{periodLabel(m.prev.period)}</span>
            </>
          ) : (
            <>
              <CardValue change={m.prev} words={["more", "fewer"]} />
              <span className="text-[13px] text-ink-3">
                {m.prev.period ? `${fmt(m.prev.value)} in ${periodLabel(m.prev.period)}` : "No earlier figure"}
              </span>
            </>
          )}
        </Card>
        <Card i={4} label="Trend" wide>
          <span className={`text-[19px] font-medium ${toneText(TREND[m.trend].tone)}`}>
            <span aria-hidden="true">{TREND[m.trend].icon}</span> {TREND[m.trend].word}
          </span>
          <button
            type="button"
            className="cursor-help justify-self-start text-[13px] text-ink-3 underline decoration-dotted underline-offset-3"
            aria-expanded={showRule}
            aria-controls="trend-rule"
            onClick={() => setShowRule((s) => !s)}
          >
            How we decide
          </button>
        </Card>
      </section>
      <p
        id="trend-rule"
        hidden={!showRule}
        className="mt-2.5 max-w-[70ch] rounded-lg border border-rule bg-surface px-3.5 py-3 text-sm text-ink-2"
      >
        We compare{" "}
        {m.basis === "roll"
          ? "the last 3 months with the same 3 months a year earlier"
          : `the latest ${unit} with the same ${unit} a year earlier`}
        . Up 10% or more is <b className="font-medium">Growing</b>, down 10% or more is{" "}
        <b className="font-medium">Shrinking</b>, in between is <b className="font-medium">Steady</b>. Under{" "}
        {m.basis === "roll" ? `${MIN_VOLUME * 3} adverts over the 3 months` : `${MIN_VOLUME} adverts`} we don’t call a trend. This is our reading of ONS data, not an ONS measure.
      </p>

      {/* Chart with the Monthly/Quarterly switch and ranges */}
      <section className="mt-7" aria-labelledby="chart-h">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <h2 id="chart-h" className="text-[19px]">
            Adverts per {unit}
          </h2>
          <Tabs
            label="Show figures by"
            options={[
              { key: "M", text: "Monthly", disabled: !hasOther.M },
              { key: "Q", text: "Quarterly", disabled: !hasOther.Q },
            ]}
            value={view.cadence}
            onChange={(k) => setCadence(k as Cadence)}
          />
        </div>
        <div className="mb-2.5 flex justify-end">
          <Tabs
            label="Time range"
            options={RANGES[view.cadence].map((r) => ({ key: r.key, text: r.key }))}
            value={range}
            onChange={setRange}
          />
        </div>
        <div className="rounded-card border border-rule bg-surface px-2 pt-3.5 pb-2">
          <Chart periods={shownP} values={shownV} avg={m.avg5y.value} unit={unit} notices={notices} />
        </div>
        <button
          type="button"
          className="py-2 text-sm text-ink-2 underline"
          aria-expanded={showTable}
          aria-controls="chart-table"
          onClick={() => setShowTable((s) => !s)}
        >
          {showTable ? "Hide" : "Show"} the numbers
        </button>
        {showTable && (
          <div id="chart-table" className="overflow-x-auto rounded-card border border-rule bg-surface px-4 py-2">
            <table className="w-full min-w-[300px] border-collapse text-[14.5px]">
              <thead>
                <tr className="text-[13px] text-ink-3">
                  <th scope="col" className="border-b border-rule py-1.5 text-left font-normal">
                    Period
                  </th>
                  <th scope="col" className="border-b border-rule py-1.5 text-right font-normal">
                    Adverts
                  </th>
                </tr>
              </thead>
              <tbody>
                {showUnpublished && (
                  <tr>
                    <td className="border-b border-rule py-1.5 pr-4 whitespace-nowrap">{periodLabel(nextQuarter!, "long")}</td>
                    <td className="border-b border-rule py-1.5 text-right">
                      <MissingTag missing={unpublished(nextQuarter!)} info />
                    </td>
                  </tr>
                )}
                {shownP
                  .map((p, i) => ({ p, val: shownV[i] }))
                  .reverse()
                  .map(({ p, val }) => {
                    const est = val != null ? estimatedFor(p, notices) : undefined;
                    return (
                      <tr key={p}>
                        <td className="border-b border-rule py-1.5 pr-4 whitespace-nowrap">{periodLabel(p, "long")}</td>
                        <td className="border-b border-rule py-1.5 text-right tabular-nums">
                          {val == null ? (
                            <MissingTag missing={missingFor(p, notices)} info />
                          ) : (
                            <span className="inline-flex items-center justify-end gap-2">
                              {est && <EstimatedTag reason={est.reason} source={sourceOf(est)} />}
                              {fmt(val)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Places view={view} job={job} place={place} notices={notices} what={view.broader ? sentenceCase(view.job.name) : job.name} />

      <AboutData view={view} notices={notices} release={release} m={m} />
    </>
  );
}

function HeroChip({ head, m }: { head: Change; m: NonNullable<View["m"]> }) {
  const d = direction(head);
  const base = "mt-3.5 inline-flex w-max max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 text-base font-medium";
  if (head.s === "ok") {
    const when =
      m.basis === "roll" && m.roll?.from
        ? `${windowLabel(m.roll.from, m.roll.to)}: `
        : "";
    const than = m.basis === "roll" ? "a year ago" : m.yoy.period ? periodLabel(m.yoy.period) : "a year ago";
    return (
      <span className={`${base} ${toneChip(d)}`}>
        <span aria-hidden="true">{ARROW[d]}</span>
        {when}
        {d === "flat" ? `the same as ${than}` : `${fmtPct(head.pct!)}% ${head.pct! < 0 ? "fewer" : "more"} than ${than}`}
      </span>
    );
  }
  const text =
    head.s === "small"
      ? "Too few adverts to compare"
      : head.s === "zero"
        ? "None a year earlier, so no % change"
        : "No figure from a year ago";
  return <span className={`${base} ${toneChip("na")}`}>{text}</span>;
}

function Card({ i, label, wide, children }: { i: number; label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`ink-in grid min-w-0 content-start gap-1 rounded-card border border-rule bg-surface px-4 py-3.5 ${wide ? "col-span-2 sm:col-span-1" : ""}`}
      style={ink(i)}
    >
      <span className="text-[13px] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function CardValue({ change, words }: { change: Change; words: [string, string] }) {
  if (change.s === "ok") {
    const d = direction(change);
    return (
      <span className={`text-[19px] font-medium ${toneText(d)}`}>
        <span aria-hidden="true">{ARROW[d]}</span> {Math.round(Math.abs(change.pct!))}%{" "}
        {change.pct! < 0 ? words[1] : words[0]}
      </span>
    );
  }
  const text = change.s === "small" ? "Too few to compare" : change.s === "zero" ? "None to compare" : "Not enough history";
  return <span className="text-[19px] font-medium text-ink-3">{text}</span>;
}

function Places({
  view,
  job,
  place,
  notices,
  what,
}: {
  view: View;
  job: { slug: string };
  place: { name: string; slug: string };
  notices: Notice[];
  what: string;
}) {
  const more = (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      <Link to={`/occupation/${job.slug}${view.cadence === "Q" ? "?view=quarterly" : ""}`} className="underline">
        See all places for this job ›
      </Link>
      <Link to={`/location/${place.slug}${view.cadence === "Q" ? "?view=quarterly" : ""}`} className="underline">
        Every job in {place.name} ›
      </Link>
    </p>
  );
  if (view.places.length < 2) return more;
  const newest = view.places[0].period;
  const missing = missingFor(newest, notices);
  const qs = view.cadence === "Q" ? "?view=quarterly" : "";
  return (
    <section className="mt-7" aria-labelledby="places-h">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="places-h" className="text-[19px]">
          {what} in other places
        </h2>
        <span className="text-[13.5px] text-ink-3">{periodLabel(newest)}</span>
      </div>
      <ol className="rounded-card border border-rule bg-surface px-4 py-1">
        {view.places.map((p) => {
          const d = direction(p.change);
          return (
            <li
              key={p.code}
              className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-rule py-2.5 text-[15px] last:border-b-0 ${p.me ? "font-medium" : ""}`}
            >
              {p.me ? (
                <span>{p.name}</span>
              ) : (
                <Link to={`/market/${job.slug}/${p.slug}${qs}`} className="truncate hover:underline">
                  {p.name}
                </Link>
              )}
              <span className="text-right tabular-nums">
                {p.value == null ? <MissingTag missing={missing} info /> : fmt(p.value)}
              </span>
              <span className={`min-w-14 text-right text-[13.5px] font-medium ${toneText(d)}`}>
                {p.change?.s === "ok" ? (
                  <>
                    <span aria-hidden="true">{ARROW[d]}</span> {Math.round(Math.abs(p.change.pct!))}%
                    <span className="sr-only"> {p.change.pct! < 0 ? "fewer" : "more"} than a year earlier</span>
                  </>
                ) : p.change?.s === "small" ? (
                  <span className="font-normal text-ink-3">too few</span>
                ) : (
                  <span className="font-normal text-ink-3">–</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[13px] text-ink-3">
        {view.cadence === "M"
          ? "Change compares the last 3 months with the same 3 months a year earlier, or the single month where one of those months is missing."
          : "Change compares the quarter with the same quarter a year earlier."}
      </p>
      {more}
    </section>
  );
}

function AboutData({
  view,
  notices,
  release,
  m,
}: {
  view: View;
  notices: Notice[];
  release: { publishedOn: string };
  m: NonNullable<View["m"]>;
}) {
  const published = dateLabel(release.publishedOn);
  const issues = notices.filter((n) => (view.cadence === "M" ? n.months : n.quarters).length > 0);
  return (
    <details className="mt-7 rounded-card border border-rule bg-surface px-[18px] py-1">
      <summary className="cursor-pointer py-3 font-medium">About this data</summary>
      <dl className="mt-1 mb-3 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-2.5 text-[14.5px]">
        {[
          ["Source", "Office for National Statistics"],
          ["Measure", "New online job adverts"],
          ["Latest figure", periodLabel(m.latest.period, "long")],
          ["Published", published],
        ].map(([dt, dd]) => (
          <div key={dt}>
            <dt className="text-[12.5px] text-ink-3">{dt}</dt>
            <dd className="mt-0.5">{dd}</dd>
          </div>
        ))}
      </dl>
      <ul className="mb-3.5 grid list-disc gap-1 pl-5 text-[14.5px] text-ink-2">
        <li>An advert isn’t the same as a job. ONS removes duplicates it can detect, but some roles are still advertised more than once.</li>
        <li>Some jobs are never advertised online.</li>
        <li>Gaps mean ONS has no reliable figure. They never mean zero adverts.</li>
        <li>ONS says short-term changes since November 2025 are less reliable; compare over longer periods.</li>
        <li>These are official statistics in development, so methods may still change.</li>
      </ul>
      {issues.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-[15px]">ONS data issues in this release</h3>
          <ul className="grid gap-2 text-[14px]">
            {issues.map((n) => (
              <li key={n.heading}>
                <details>
                  <summary className="cursor-pointer">
                    <span className="font-medium">{n.heading.replace(/^Data issue\s*-\s*(data for\s+)?/i, "")}</span>
                    <span className="text-ink-3"> · {n.reason}</span>
                  </summary>
                  <blockquote className="mt-2 border-l-2 border-rule pl-3 text-[13.5px] whitespace-pre-line text-ink-2">
                    “{n.ons}”
                    <footer className="mt-1 text-[12px] text-ink-3">Quoted from the ONS workbook, published {published}</footer>
                  </blockquote>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mb-4 text-[14px]">
        <Link to="/about-data#method" className="underline underline-offset-2">
          How we compare figures, and what the data can’t tell you ›
        </Link>
      </p>
    </details>
  );
}

function Tabs({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; text: string; disabled?: boolean }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-full border border-rule bg-surface p-[3px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          disabled={o.disabled}
          onClick={() => onChange(o.key)}
          className="min-h-[34px] min-w-11 cursor-pointer rounded-full px-2.5 text-sm text-ink-2 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-ink aria-pressed:text-bg"
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

const toneText = (d: string) => (d === "up" ? "text-up" : d === "down" ? "text-down" : d === "flat" ? "text-flat" : "text-ink-3");
const toneChip = (d: string) =>
  d === "up" ? "bg-up-bg text-up" : d === "down" ? "bg-down-bg text-down" : "bg-flat-bg text-flat";
