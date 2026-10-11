import { data, Link, useSearchParams } from "react-router";

import type { Route } from "./+types/location";
import { LinkTabs, Pager, RankingTable, Showing, SortTabs, TotalCard, ViewTabs } from "~/components/rankings/Ranking";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard, type LocationShard, type Meta, type SearchIndex } from "~/lib/data.server";
import { periodLabel, sentenceCase } from "~/lib/format";
import { placeName } from "~/lib/market.server";
import { missingFor } from "~/lib/missing";
import { parseRankParams, rankHref, rankItems, type RankItem } from "~/lib/rankings";

/**
 * One place, every job (docs/02-design.md §1). Monthly: exact jobs for the UK and regions, 3-digit groups for a local
 * authority (the only monthly local figures ONS publishes). Quarterly: exact jobs everywhere; ?group=213 narrows a
 * local authority's quarterly list to one group, which is where a group row links.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const [index, meta] = await Promise.all([
    loadShard<SearchIndex>(request, "search.json"),
    loadShard<Meta>(request, "meta.json"),
  ]);
  const place = index?.places.find((p) => p.slug === params.location);
  if (!index || !meta || !place) throw data("Not found", { status: 404 });
  const shard = await loadShard<LocationShard>(request, `location/${place.slug}.json`);
  if (!shard) throw data("Not found", { status: 404 });

  const rp = parseRankParams(new URL(request.url).searchParams, "group");
  const list = rp.view === "M" ? shard.monthly : shard.quarterly;
  const newest = rp.view === "M" ? shard.months.end : shard.quarters.end;
  const jobs = new Map(index.occupations.map((o) => [o.soc, o]));
  const group = rp.view === "Q" && rp.filter && index.groups[rp.filter] ? rp.filter : null;

  const items: RankItem[] = list.rows
    .filter((r) => !group || r.c.startsWith(group))
    .map((r) => {
      const current = r.p === newest;
      const job = list.level === 4 ? jobs.get(r.c) : undefined;
      return {
        key: r.c,
        name: job ? job.name : sentenceCase(index.groups[r.c]?.name ?? r.c),
        href: job
          ? `/market/${job.slug}/${place.slug}${rp.view === "Q" ? "?view=quarterly" : ""}`
          : `/location/${place.slug}?view=quarterly&group=${r.c}`,
        value: current ? r.v : null,
        change: current ? { s: r.s, pct: r.pct } : null,
        trend: current ? r.t : "na",
      };
    });

  const region = place.region ? index.places.find((p) => p.code === place.region) : undefined;
  return {
    place: { name: placeName(place), slug: place.slug, type: place.type },
    region: region && { name: placeName(region), slug: region.slug },
    view: rp.view,
    sort: rp.sort,
    newest,
    level: list.level,
    total: shard.total?.m ?? null,
    ranked: rankItems(items, rp.sort, rp.page, rp.rows),
    group: group && { code: group, name: sentenceCase(index.groups[group].name) },
    counts: { M: shard.monthly.rows.length, Q: shard.quarterly.rows.length },
    notices: meta.notices,
  };
}

export function headers() {
  return { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Not found | Is the market cooked?" }];
  const { place } = loaderData;
  return [
    { title: `Jobs being advertised in ${place.name} | Is the market cooked?` },
    {
      name: "description",
      content: `Which jobs have the most online adverts in ${place.name}, and which are growing or shrinking. Official ONS figures.`,
    },
  ];
}

export default function Location({ loaderData }: Route.ComponentProps) {
  const { place, region, view, sort, newest, level, total, ranked, group, counts, notices } = loaderData;
  const [sp] = useSearchParams();
  const noun = group ? "jobs in this group" : level === 3 ? "job groups" : "jobs";
  const totalNote =
    place.type === "region" && !total
      ? `ONS doesn’t publish an all-jobs total for ${place.name}, so there’s no headline figure here. The jobs below are ONS’s regional figures.`
      : undefined;
  return (
    <>
      <SiteHeader>
        <Link to="/" className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-rule bg-surface-2 px-3.5 text-sm" aria-label="Change search">
          <span className="truncate">{place.name}</span>
          <span aria-hidden="true">✎</span>
        </Link>
      </SiteHeader>
      <main className="mx-auto max-w-[1040px] px-4 md:px-8">
        <section className="ink-in pt-[22px]" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="text-[13.5px] text-ink-3">
            Places ›{" "}
            {region && (
              <>
                <Link to={`/location/${region.slug}`} className="hover:underline">
                  {region.name}
                </Link>{" "}
                ›{" "}
              </>
            )}
            {place.name}
          </p>
          <h1 className="mt-1.5 text-[clamp(26px,4vw,38px)] leading-[1.1] tracking-[-0.025em]">
            What jobs are being advertised in {place.name}?
          </h1>
          <p className="mt-1.5 text-[14.5px] text-ink-3">
            {place.name}
            {region ? `, ${region.name}` : ""} · new online job adverts by job · {periodLabel(newest, "long")}
          </p>
        </section>

        <TotalCard label={`All jobs in ${place.name}`} m={total} note={totalNote} />

        {level === 3 && (
          <p className="mt-3 max-w-[72ch] rounded-lg border border-rule bg-surface px-3.5 py-3 text-[14.5px] text-ink-2">
            Monthly figures for {place.name} only exist for broader job groups, so this lists{" "}
            <b className="font-medium">{counts.M} job groups</b>. Switch to <b className="font-medium">Quarterly</b> for all{" "}
            {counts.Q} exact jobs, or pick a group to see the jobs in it.
          </p>
        )}

        <div className="mt-[22px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <h2 className="text-[19px]">Jobs in {place.name}</h2>
          <ViewTabs view={view} has={{ M: counts.M > 0, Q: counts.Q > 0 }} />
        </div>
        {group && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
            Showing jobs in <b className="font-medium">{group.name}</b> (SOC {group.code})
            <LinkTabs small label="Group filter" options={[{ key: "all", text: "Show all jobs", on: false, href: rankHref(sp, { group: null }) }]} />
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <Showing ranked={ranked} noun={noun} sort={sort} />
          <SortTabs sort={sort} />
        </div>

        <RankingTable ranked={ranked} firstCol={level === 3 ? "Job group" : "Job"} missing={missingFor(newest, notices)} />
        <Pager ranked={ranked} />
        <p className="mt-2.5 max-w-[80ch] text-[13px] text-ink-3">
          {view === "M"
            ? "Change compares the last 3 months with the same 3 months a year earlier, or the single month when one of those months is missing."
            : "Change compares the quarter with the same quarter a year earlier."}{" "}
          Under 30 adverts (90 over 3 months) we don’t show a percentage, and those jobs are left out of “Biggest rise” and
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
