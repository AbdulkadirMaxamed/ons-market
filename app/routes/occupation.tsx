import { data, Link, redirect, useSearchParams } from "react-router";

import type { Route } from "./+types/occupation";
import { LinkTabs, Pager, RankingTable, Showing, SortTabs, TotalCard, ViewTabs } from "~/components/rankings/Ranking";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard, type Meta, type OccupationShard, type SearchIndex, type Series } from "~/lib/data.server";
import { inSentence, periodLabel } from "~/lib/format";
import { placeName } from "~/lib/market.server";
import { missingFor } from "~/lib/missing";
import { parseRankParams, rankHref, rankItems, type RankItem } from "~/lib/rankings";
import { jobBySlug } from "~/lib/search";

/** One job, every place (docs/02-design.md §1): monthly for the UK and regions, quarterly for every local area. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const [index, meta] = await Promise.all([
    loadShard<SearchIndex>(request, "search.json"),
    loadShard<Meta>(request, "meta.json"),
  ]);
  const found = index && jobBySlug(index.occupations, params.occupation);
  if (!index || !meta || !found) throw data("Not found", { status: 404 });
  const occ = found.job;
  if (found.moved) throw redirect(`/occupation/${occ.slug}${new URL(request.url).search}`, 301);
  const shard = await loadShard<OccupationShard>(request, `occupation/${occ.soc}.json`);
  if (!shard) throw data("Not found", { status: 404 });

  const rp = parseRankParams(new URL(request.url).searchParams, "region");
  const series = rp.view === "M" ? shard.monthly : shard.quarterly;
  const newest = rp.view === "M" ? shard.months.end : shard.quarters.end;
  const regions = index.places.filter((p) => p.type === "region");
  const region = rp.view === "Q" && rp.filter ? regions.find((r) => r.code === rp.filter) : undefined;

  // Monthly: the regions (the UK is the headline card). Quarterly: every local authority and London.
  const candidates = index.places.filter((p) =>
    rp.view === "M"
      ? p.type === "region"
      : (p.type === "lad" || p.code === "TLI") && (!region || p.region === region.code || p.code === region.code),
  );
  const items: RankItem[] = candidates.flatMap((p) => {
    const s: Series | undefined = series[p.code];
    if (!s) return [];
    const m = s.m && s.m.latest.period === newest ? s.m : null;
    const head = m && (m.basis === "roll" && m.roll ? m.roll : m.yoy);
    return [{
      key: p.code,
      name: placeName(p),
      href: `/market/${occ.slug}/${p.slug}${rp.view === "Q" ? "?view=quarterly" : ""}`,
      value: m ? m.latest.value : null,
      change: head ? { s: head.s, pct: head.pct ?? null } : null,
      trend: m?.trend ?? "na",
    }];
  });

  return {
    job: { name: occ.name, ons: shard.ons ?? occ.name, slug: occ.slug, soc: occ.soc },
    view: rp.view,
    sort: rp.sort,
    newest,
    uk: series["K02000001"]?.m ?? null,
    ukDerived: !!series["K02000001"]?.derived,
    ranked: rankItems(items, rp.sort, rp.page, rp.rows),
    regions: rp.view === "Q" ? regions.map((r) => ({ code: r.code, name: r.name })) : [],
    region: region?.code ?? null,
    localCount: Object.keys(shard.quarterly).filter((c) => index.places.some((p) => p.code === c && (p.type === "lad" || c === "TLI"))).length,
    notices: meta.notices,
  };
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found | Is the market cooked?" }];
  const { job } = loaderData;
  return [
    { title: `Where are ${inSentence(job.name)} being hired? | Is the market cooked?` },
    {
      name: "description",
      content: `ONS online job-advert figures for ${inSentence(job.name)} across the UK, ranked by region and local area, with the change on a year ago.`,
    },
  ];
}

export default function Occupation({ loaderData }: Route.ComponentProps) {
  const { job, view, sort, newest, uk, ukDerived, ranked, regions, region, localCount, notices } = loaderData;
  const [sp] = useSearchParams();
  const noun = view === "M" ? "regions" : region ? "local areas in this region" : "local areas";
  return (
    <>
      <SiteHeader>
        <Link to="/" className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-rule bg-surface-2 px-3.5 text-sm" aria-label="Change search">
          <span className="truncate">{job.name}</span>
          <span aria-hidden="true">✎</span>
        </Link>
      </SiteHeader>
      <main className="mx-auto max-w-[1040px] px-4 md:px-8">
        <section className="ink-in pt-[22px]" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="text-[13.5px] text-ink-3">Jobs › {job.name}</p>
          <h1 className="mt-1.5 text-[clamp(26px,4vw,38px)] leading-[1.1] tracking-[-0.025em]">
            Where are {inSentence(job.name)} being hired?
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-3">
            {job.ons !== job.name && <>ONS name: {job.ons} · </>}SOC {job.soc} · new online job adverts by area ·{" "}
            {periodLabel(newest, "long")}
          </p>
        </section>

        <TotalCard
          label="United Kingdom"
          m={uk}
          note={
            <Link to={`/market/${job.slug}/united-kingdom${view === "Q" ? "?view=quarterly" : ""}`} className="underline">
              See the full UK picture
            </Link>
          }
        />
        {ukDerived && (
          <p className="mt-2 text-[13px] text-ink-3">UK quarterly figures add up ONS’s three monthly figures for each quarter.</p>
        )}

        <div className="mt-[22px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <h2 className="text-[19px]">{view === "M" ? "Regions" : "Local areas"}</h2>
          <ViewTabs view={view} has={{ M: true, Q: localCount > 0 }} />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <span className="text-[13.5px] text-ink-3">
            <Showing ranked={ranked} noun={noun} sort={sort} />
            {view === "M" && localCount > 0 && <> · Switch to <b className="font-medium">Quarterly</b> for all {localCount} local areas.</>}
          </span>
          <SortTabs sort={sort} />
        </div>
        {view === "Q" && regions.length > 0 && (
          <div className="mt-2.5 grid gap-1.5 text-[13.5px] text-ink-3">
            <span>Filter by region</span>
            <RegionFilter regions={regions} region={region} sp={sp} />
          </div>
        )}

        <RankingTable ranked={ranked} firstCol={view === "M" ? "Region" : "Local area"} missing={missingFor(newest, notices)} />
        <Pager ranked={ranked} />
        <p className="mt-2.5 max-w-[80ch] text-[13px] text-ink-3">
          {view === "M"
            ? "Change compares the last 3 months with the same 3 months a year earlier, or the single month when one of those months is missing."
            : "Change compares the quarter with the same quarter a year earlier."}{" "}
          Under 30 adverts (90 over 3 months) we don’t show a percentage, and those areas are left out of “Biggest rise” and
          “Biggest fall”.{" "}
          <Link to="/about-data#method" className="underline underline-offset-2">
            How we compare figures
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

/** Region filter as links in a wrapping row (works without JavaScript). */
function RegionFilter({ regions, region, sp }: { regions: { code: string; name: string }[]; region: string | null; sp: URLSearchParams }) {
  return (
    <div>
      <LinkTabs
        small
        wrap
        label="Filter by region"
        options={[
          { key: "all", text: "All", on: !region, href: rankHref(sp, { region: null }) },
          ...regions.map((r) => ({ key: r.code, text: r.name, on: r.code === region, href: rankHref(sp, { region: r.code }) })),
        ]}
      />
    </div>
  );
}
