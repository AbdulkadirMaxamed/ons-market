import { Form, Link } from "react-router";

import type { Route } from "./+types/home";
import { SiteFooter, SiteHeader } from "~/components/SiteChrome";
import { loadShard, type Meta } from "~/lib/data.server";

// Until search lands, a few real examples (Phase 3: homepage search).
const TRY = [
  ["Software developers in Manchester", "/market/programmers-and-software-development-professionals/manchester"],
  ["Data analysts in Leeds", "/market/data-analysts/leeds"],
  ["Chefs in London", "/market/chefs/london"],
] as const;

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
  const meta = await loadShard<Meta>(request, "meta.json");
  return { meta: meta && { releaseLabel: meta.releaseLabel, latestMonth: meta.latestMonth } };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { meta } = loaderData;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1040px] px-4 md:px-8">
        <section className="pt-14 pb-10 md:pt-24 md:pb-16">
          <div className="ink-in" style={{ "--i": 0 } as React.CSSProperties}>
            <h1 className="text-[clamp(40px,7.4vw,68px)] leading-[1.02] tracking-[-0.035em]">Is the market cooked?</h1>
            <p className="mt-3.5 max-w-[40ch] text-[clamp(17px,2.2vw,20px)] text-ink-2">
              See how many jobs like yours are being advertised where you live, and whether that’s going up or down.
              Real ONS figures, free.
            </p>
          </div>

          <Form
            method="get"
            action="/"
            className="ink-in mt-8 grid max-w-[780px] gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <label className="grid gap-1.5">
              <span className="text-[15px] font-medium">Job</span>
              <input
                name="job"
                placeholder="Software developer"
                className="min-h-[54px] rounded-card border border-rule bg-surface px-4 text-[17px] font-normal focus:border-ink focus:outline-none"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[15px] font-medium">Where</span>
              <input
                name="where"
                placeholder="Manchester"
                className="min-h-[54px] rounded-card border border-rule bg-surface px-4 text-[17px] font-normal focus:border-ink focus:outline-none"
              />
            </label>
            <button className="min-h-[54px] rounded-card bg-accent px-6 font-medium text-accent-ink">
              Check the market
            </button>
          </Form>

          {meta && (
            <div className="ink-in mt-3 flex flex-wrap items-center gap-2" style={{ "--i": 2 } as React.CSSProperties}>
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
          )}

          {!meta && (
            <p className="mt-6 max-w-[60ch] rounded-lg border border-rule bg-surface px-4 py-3 text-sm text-ink-2">
              No ONS data has been imported yet. Run <code>pnpm data:import</code> and <code>pnpm data:export</code> to
              load the latest workbook.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
