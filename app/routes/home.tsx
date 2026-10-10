import { Link, redirect, useLocation } from "react-router";

import type { Route } from "./+types/home";
import { SearchForm } from "~/components/SearchForm";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard, type Meta, type Overview, type SearchIndex } from "~/lib/data.server";
import { ARROW, direction, fmt, fmtPct, periodLabel, windowLabel } from "~/lib/format";
import { resolveSearch } from "~/lib/search";

const TRY = [
  ["Software developers in Manchester", "/market/programmers-and-software-development-professionals/manchester"],
  ["Nurses in Leeds", "/market/registered-community-nurses/leeds"],
  ["Chefs in London", "/market/chefs/london"],
] as const;

const MOVERS_SHOWN = 5;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Is the market cooked? UK job-advert data for your job and area" },
    {
      name: "description",
      content:
        "See how many online job adverts there are for your job where you live, and whether that’s going up or down. Real ONS figures, free.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (k: string) => url.searchParams.get(k);
  let search: { typed: { job: string; where: string }; error: { field: "job" | "where"; message: string } } | null = null;

  // Search without JavaScript (or before the browser has the job list): resolve here and redirect.
  if (url.searchParams.has("job")) {
    const index = await loadShard<SearchIndex>(request, "search.json");
    if (index) {
      const r = resolveSearch(index, { job: q("job"), where: q("where"), jobSlug: q("jobSlug"), whereSlug: q("whereSlug") });
      if (r.ok) throw redirect(r.href);
      search = { typed: { job: q("job") ?? "", where: q("where") ?? "" }, error: r };
    }
  }

  const [meta, overview] = await Promise.all([
    loadShard<Meta>(request, "meta.json"),
    loadShard<Overview>(request, "overview.json"),
  ]);
  const uk = overview?.uk?.m;
  return {
    hasData: !!meta,
    search,
    uk: uk && {
      period: uk.latest.period,
      value: uk.latest.value,
      change: uk.basis === "roll" && uk.roll ? { ...uk.roll, window: windowLabel(uk.roll.from!, uk.roll.to) } : { ...uk.yoy, window: null },
    },
    movers: overview?.moversWindow
      ? {
          window: overview.moversWindow,
          minBase: overview.moversMinBase,
          rising: overview.rising.slice(0, MOVERS_SHOWN),
          falling: overview.falling.slice(0, MOVERS_SHOWN),
        }
      : null,
  };
}

const ink = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default function Home({ loaderData }: Route.ComponentProps) {
  const { hasData, search, uk, movers } = loaderData;
  const location = useLocation();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 md:px-8">
        <section className="pt-14 pb-10 md:pt-24 md:pb-14">
          <div className="ink-in" style={ink(0)}>
            <h1 className="text-[clamp(40px,7.4vw,68px)] leading-[1.02] tracking-[-0.035em]">Is the market cooked?</h1>
            <p className="mt-3.5 max-w-[40ch] text-[clamp(17px,2.2vw,20px)] text-ink-2">
              See how many jobs like yours are being advertised where you live, and whether that’s going up or down.
              Real ONS figures, free.
            </p>
          </div>

          <div className="ink-in relative z-10" style={ink(1)}>
            {/* Remount when the server answers a search, so its message and typed text show. */}
            <SearchForm key={location.search} initial={search?.typed} error={search?.error} />
          </div>

          {hasData ? (
            <div className="ink-in flex flex-wrap items-center gap-2" style={ink(2)}>
              <span className="text-sm text-ink-3">Try</span>
              {TRY.map(([label, href]) => (
                <Link
                  key={href}
                  to={href}
                  className="flex min-h-[38px] items-center rounded-full border border-rule bg-surface px-3.5 text-sm"
                >
                  {label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-6 max-w-[60ch] rounded-lg border border-rule bg-surface px-4 py-3 text-sm text-ink-2">
              No ONS data has been imported yet. Run <code>pnpm data:import</code> and <code>pnpm data:export</code> to
              load the latest workbook.
            </p>
          )}
        </section>

        {uk && movers && (
          <section aria-label="UK overview" className="grid gap-4 pb-14 min-[860px]:grid-cols-[1.2fr_1fr_1fr]">
            <div className="ink-in rounded-card border border-rule bg-surface p-5" style={ink(3)}>
              <p className="text-[13px] text-ink-3">UK, all jobs · {periodLabel(uk.period, "long")}</p>
              <p className="mt-1.5 mb-1 text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">
                {fmt(uk.value)}
              </p>
              <p className="text-[14.5px] text-ink-3">new online job adverts</p>
              {uk.change.s === "ok" && (
                <p className="mt-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-medium ${chip(direction(uk.change))}`}>
                    <span aria-hidden="true">{ARROW[direction(uk.change)]}</span>
                    {uk.change.window ? `${uk.change.window}: ` : ""}
                    {fmtPct(uk.change.pct!)}% {uk.change.pct! < 0 ? "fewer" : "more"} than a year ago
                  </span>
                </p>
              )}
            </div>
            <Movers i={4} title="Rising fastest" items={movers.rising} tone="up" />
            <Movers i={5} title="Falling fastest" items={movers.falling} tone="down" />
            <p className="ink-in text-[13px] text-ink-3 min-[860px]:col-span-3" style={ink(6)}>
              Rising and falling: UK, {windowLabel(movers.window.from, movers.window.to)}
              {movers.window.from.slice(0, 4) === movers.window.to.slice(0, 4) ? ` ${movers.window.to.slice(0, 4)}` : ""}{" "}
              compared with the same months a year earlier, for jobs with at least {fmt(movers.minBase)} adverts a year
              earlier.
            </p>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Movers({
  i,
  title,
  items,
  tone,
}: {
  i: number;
  title: string;
  items: { soc: string; name: string; slug: string; pct: number }[];
  tone: "up" | "down";
}) {
  return (
    <div className="ink-in rounded-card border border-rule bg-surface p-5" style={ink(i)}>
      <h2 className="mb-2 text-base">{title}</h2>
      <ol>
        {items.map((m) => (
          <li key={m.soc} className="flex justify-between gap-3 border-b border-rule py-2.5 text-[15px] last:border-b-0">
            <Link to={`/market/${m.slug}/united-kingdom`} className="min-w-0 hover:underline">
              {m.name}
            </Link>
            <span className={`font-medium whitespace-nowrap tabular-nums ${tone === "up" ? "text-up" : "text-down"}`}>
              <span aria-hidden="true">{tone === "up" ? "▲" : "▼"}</span> {Math.round(Math.abs(m.pct))}%
              <span className="sr-only"> {tone === "up" ? "more" : "fewer"} adverts</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const chip = (d: string) => (d === "up" ? "bg-up-bg text-up" : d === "down" ? "bg-down-bg text-down" : "bg-flat-bg text-flat");
