import { Link, useSearchParams } from "react-router";

import { ARROW, direction, fmt, fmtPct, periodLabel, TREND, windowLabel } from "~/lib/format";
import type { Cadence } from "~/lib/market.server";
import type { Missing } from "~/lib/missing";
import { pageList, rankHref, ROWS_OPTIONS, SORT_LABEL, SORTS, type Ranked, type RankItem, type Sort } from "~/lib/rankings";
import type { Metrics } from "~/lib/types";
import { MissingTag } from "../market/MissingTag";

const ink = (i: number) => ({ "--i": i }) as React.CSSProperties;
const toneText = (d: string) => (d === "up" ? "text-up" : d === "down" ? "text-down" : d === "flat" ? "text-flat" : "text-ink-3");
const toneChip = (d: string) => (d === "up" ? "bg-up-bg text-up" : d === "down" ? "bg-down-bg text-down" : "bg-flat-bg text-flat");

/** Headline card: an area's all-jobs total, or the UK figure for one job. */
export function TotalCard({ label, m, note }: { label: string; m: Metrics | null; note?: React.ReactNode }) {
  if (!m) {
    return (
      <div className="ink-in mt-[18px] rounded-card border border-rule bg-surface px-[22px] py-5 text-[14.5px] text-ink-2" style={ink(1)}>
        {note}
      </div>
    );
  }
  const head = m.basis === "roll" && m.roll ? m.roll : m.yoy;
  const d = direction(head);
  const t = TREND[m.trend];
  return (
    <div
      className="ink-in mt-[18px] grid gap-3.5 rounded-card border border-rule bg-surface px-[22px] py-5 md:grid-cols-[1fr_auto] md:items-center"
      style={ink(1)}
    >
      <div>
        <p className="text-[13px] text-ink-3">
          {label} · {periodLabel(m.latest.period, "long")}
        </p>
        <p className="mt-1 mb-0.5 text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] tabular-nums">{fmt(m.latest.value)}</p>
        <p className="text-[13.5px] text-ink-3">new online job adverts</p>
      </div>
      <div>
        {head.s === "ok" ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-medium ${toneChip(d)}`}>
            <span aria-hidden="true">{ARROW[d]}</span>
            {m.basis === "roll" && m.roll?.from ? `${windowLabel(m.roll.from, m.roll.to)}: ` : ""}
            {fmtPct(head.pct!)}% {head.pct! < 0 ? "fewer" : "more"} than{" "}
            {m.basis === "roll" ? "a year ago" : m.yoy.period ? periodLabel(m.yoy.period) : "a year ago"}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-flat-bg px-3 py-1 text-[15px] font-medium text-flat">No comparison with a year ago</span>
        )}
        <p className="mt-2 text-[13.5px] text-ink-3">
          Trend:{" "}
          <b className={`font-medium ${toneText(t.tone)}`}>
            {t.icon} {t.word}
          </b>
          {note ? <> · {note}</> : null}
        </p>
      </div>
    </div>
  );
}

/** Pill of links (the state lives in the URL, so it works without JavaScript and can be shared). */
export function LinkTabs({
  label,
  options,
  small,
  wrap,
}: {
  label: string;
  options: { key: string; text: string; href: string | null; on: boolean }[];
  small?: boolean;
  wrap?: boolean; // many options: wrap onto more lines instead of one pill
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex gap-1 border border-rule bg-surface p-[3px] ${wrap ? "flex-wrap rounded-2xl" : "rounded-full"}`}
    >
      {options.map((o) =>
        o.href == null ? (
          <span key={o.key} aria-disabled="true" className={`flex items-center rounded-full px-3 text-sm text-ink-3 opacity-40 ${small ? "min-h-7" : "min-h-[34px]"}`}>
            {o.text}
          </span>
        ) : (
          <Link
            key={o.key}
            to={o.href}
            preventScrollReset
            replace
            aria-current={o.on ? "true" : undefined}
            className={`flex items-center rounded-full px-3 whitespace-nowrap ${small ? "min-h-7 text-[13.5px]" : "min-h-[34px] text-sm"} ${
              o.on ? "bg-ink text-bg" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {o.text}
          </Link>
        ),
      )}
    </div>
  );
}

export function ViewTabs({ view, has }: { view: Cadence; has: Record<Cadence, boolean> }) {
  const [sp] = useSearchParams();
  return (
    <LinkTabs
      label="Show figures by"
      options={[
        { key: "M", text: "Monthly", on: view === "M", href: has.M ? rankHref(sp, { view: null, region: null, group: null }) : null },
        { key: "Q", text: "Quarterly", on: view === "Q", href: has.Q ? rankHref(sp, { view: "quarterly", region: null, group: null }) : null },
      ]}
    />
  );
}

export function SortTabs({ sort }: { sort: Sort }) {
  const [sp] = useSearchParams();
  return (
    <LinkTabs
      label="Sort by"
      options={SORTS.map((s) => ({ key: s, text: SORT_LABEL[s], on: s === sort, href: rankHref(sp, { sort: s }) }))}
    />
  );
}

export function RankingTable<T extends RankItem>({
  ranked,
  firstCol,
  missing,
}: {
  ranked: Ranked<T>;
  firstCol: string;
  missing: Missing;
}) {
  if (ranked.items.length === 0) {
    return <p className="mt-2.5 rounded-card border border-rule bg-surface px-4 py-5 text-ink-2">Nothing to show here.</p>;
  }
  return (
    <div className="mt-2.5 overflow-x-auto rounded-card border border-rule bg-surface px-4 py-1">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr className="text-left text-[13px] text-ink-3">
            <th scope="col" className="hidden w-[34px] border-b border-rule py-2.5 font-normal sm:table-cell">
              #
            </th>
            <th scope="col" className="border-b border-rule py-2.5 pr-2 font-normal">
              {firstCol}
            </th>
            <th scope="col" className="border-b border-rule py-2.5 pr-2 text-right font-normal">
              Adverts
            </th>
            <th scope="col" className="border-b border-rule py-2.5 pr-2 text-right font-normal">
              Change
            </th>
            <th scope="col" className="hidden border-b border-rule py-2.5 pl-3.5 font-normal sm:table-cell">
              Trend
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.items.map((it) => {
            const d = direction(it.change && it.change.s === "ok" ? { s: "ok", pct: it.change.pct! } : null);
            const t = TREND[it.trend] ?? TREND.na;
            const trend =
              it.value == null ? null : (
                <span className={`text-sm font-medium whitespace-nowrap ${toneText(t.tone)}`}>
                  <span aria-hidden="true">{t.icon}</span> {t.word}
                </span>
              );
            return (
              <tr key={it.key} className="border-b border-rule last:border-b-0">
                <td className="hidden py-2.5 text-ink-3 tabular-nums sm:table-cell">{it.rank ?? ""}</td>
                <td className="py-2.5 pr-2">
                  {it.href ? (
                    <Link to={it.href} className="hover:underline">
                      {it.name}
                    </Link>
                  ) : (
                    it.name
                  )}
                  {trend && <span className="mt-px block text-[12.5px] sm:hidden">{trend}</span>}
                </td>
                <td className="py-2.5 pr-2 text-right whitespace-nowrap tabular-nums">
                  {it.value == null ? <MissingTag missing={missing} info /> : fmt(it.value)}
                </td>
                <td className={`py-2.5 pr-2 text-right font-medium whitespace-nowrap tabular-nums ${toneText(d)}`}>
                  {it.change?.s === "ok" && it.value != null ? (
                    <>
                      <span aria-hidden="true">{ARROW[d]}</span> {fmtPct(it.change.pct!)}%
                      <span className="sr-only"> {it.change.pct! < 0 ? "fewer" : "more"} than a year earlier</span>
                    </>
                  ) : it.change?.s === "small" && it.value != null ? (
                    <span className="font-normal text-ink-3">too few</span>
                  ) : (
                    <span className="font-normal text-ink-3">–</span>
                  )}
                </td>
                <td className="hidden py-2.5 pl-3.5 sm:table-cell">{trend ?? <span className="text-ink-3">–</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pager<T extends RankItem>({ ranked }: { ranked: Ranked<T> }) {
  const [sp] = useSearchParams();
  const link = (page: number) => rankHref(sp, { page });
  const btn = "rounded-full border border-rule bg-surface px-3.5 py-2 text-sm";
  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
      {ranked.page > 1 ? (
        <Link to={link(ranked.page - 1)} preventScrollReset className={btn} rel="prev">
          ‹ Previous
        </Link>
      ) : (
        <span className={`${btn} opacity-40`} aria-disabled="true">
          ‹ Previous
        </span>
      )}
      {ranked.pages > 1 && (
        <ol className="flex items-center gap-1 text-sm text-ink-2">
          {pageList(ranked.page, ranked.pages).map((n, i) =>
            n == null ? (
              <li key={`gap${i}`} aria-hidden="true" className="px-1">
                …
              </li>
            ) : (
              <li key={n}>
                <Link
                  to={link(n)}
                  preventScrollReset
                  aria-current={n === ranked.page ? "page" : undefined}
                  aria-label={`Page ${n}`}
                  className={`grid min-h-8 min-w-8 place-items-center rounded-full px-2 ${n === ranked.page ? "bg-ink font-medium text-bg" : "hover:bg-surface"}`}
                >
                  {n}
                </Link>
              </li>
            ),
          )}
        </ol>
      )}
      <span className="order-3 flex w-full items-center justify-center gap-2 text-[13.5px] text-ink-3 sm:order-none sm:w-auto">
        Rows per page
        <LinkTabs
          small
          label="Rows per page"
          options={ROWS_OPTIONS.map((r) => ({ key: String(r), text: String(r), on: r === ranked.rows, href: rankHref(sp, { rows: r }) }))}
        />
      </span>
      {ranked.page < ranked.pages ? (
        <Link to={link(ranked.page + 1)} preventScrollReset className={btn} rel="next">
          Next ›
        </Link>
      ) : (
        <span className={`${btn} opacity-40`} aria-disabled="true">
          Next ›
        </span>
      )}
    </nav>
  );
}

/** "Showing 1–10 of 104 job groups", plus how many a rise/fall sort left out. */
export function Showing<T extends RankItem>({ ranked, noun, sort }: { ranked: Ranked<T>; noun: string; sort: Sort }) {
  const to = Math.min(ranked.from + ranked.rows - 1, ranked.total);
  return (
    <span className="text-[13.5px] text-ink-3">
      {ranked.total ? `Showing ${ranked.from}–${to} of ${ranked.total} ${noun}` : `No ${noun}`}
      {sort !== "adverts" && ranked.excluded > 0 ? ` · ${ranked.excluded} with too few adverts or no comparison left out` : ""}
    </span>
  );
}
