/** Sorting and paging for the ranking pages. Pure; the pages do it on the server so only one page of rows is sent. */

import type { Cadence } from "./market.server";

export const ROWS_OPTIONS = [10, 25] as const;
export const DEFAULT_ROWS = 10;
export const SORTS = ["adverts", "rise", "fall"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = { adverts: "Most adverts", rise: "Biggest rise", fall: "Biggest fall" };

export type RankParams = {
  view: Cadence;
  sort: Sort;
  page: number;
  rows: number;
  filter: string | null; // region code (job pages) or 3-digit group (place pages)
};

/** Read ?view, ?sort, ?page, ?rows and a filter param, falling back to defaults for anything unexpected. */
export function parseRankParams(sp: URLSearchParams, filterKey: string): RankParams {
  const sort = sp.get("sort") as Sort;
  const rows = Number(sp.get("rows"));
  const page = Math.floor(Number(sp.get("page")));
  return {
    view: sp.get("view") === "quarterly" ? "Q" : "M",
    sort: SORTS.includes(sort) ? sort : "adverts",
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    rows: (ROWS_OPTIONS as readonly number[]).includes(rows) ? rows : DEFAULT_ROWS,
    filter: sp.get(filterKey) || null,
  };
}

/** Query string for a link that changes some params. Anything that reorders the list goes back to page 1. */
export function rankHref(sp: URLSearchParams, changes: Record<string, string | number | null>): string {
  const next = new URLSearchParams(sp);
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === "") next.delete(k);
    else next.set(k, String(v));
  }
  if (!("page" in changes)) next.delete("page");
  for (const [k, def] of [["view", "monthly"], ["sort", "adverts"], ["rows", String(DEFAULT_ROWS)], ["page", "1"]]) {
    if (next.get(k) === def) next.delete(k);
  }
  const q = next.toString();
  return q ? `?${q}` : "?";
}

export type RankItem = {
  key: string;
  name: string;
  href: string | null;
  value: number | null; // figure for the newest period; null when ONS has none
  change: { s: string; pct: number | null } | null;
  trend: string;
};

export type Ranked<T extends RankItem> = {
  items: (T & { rank: number | null })[];
  total: number; // rows in the sorted list
  excluded: number; // left out of a rise/fall sort for having too few adverts or no comparison
  page: number;
  pages: number;
  rows: number;
  from: number; // 1-based position of the first row shown
};

export function rankItems<T extends RankItem>(items: T[], sort: Sort, page: number, rows: number): Ranked<T> {
  let list: T[];
  if (sort === "adverts") {
    list = [...items].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name));
  } else {
    const ok = items.filter((i) => i.change?.s === "ok" && i.change.pct != null);
    const dir = sort === "rise" ? -1 : 1;
    list = ok.sort((a, b) => dir * (a.change!.pct! - b.change!.pct!) || (b.value ?? 0) - (a.value ?? 0));
  }
  const pages = Math.max(1, Math.ceil(list.length / rows));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * rows;
  return {
    items: list.slice(start, start + rows).map((it, i) => ({ ...it, rank: it.value == null ? null : start + i + 1 })),
    total: list.length,
    excluded: items.length - list.length,
    page: p,
    pages,
    rows,
    from: list.length ? start + 1 : 0,
  };
}

/** Page numbers to show: first, last, and the current page with its neighbours; null marks a gap ("…"). */
export function pageList(page: number, pages: number): (number | null)[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out: (number | null)[] = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, arr) => {
    const gap = i ? n - arr[i - 1] - 1 : 0;
    if (gap === 1) out.push(n - 1); // a "…" would hide only one page: show it instead
    else if (gap > 1) out.push(null);
    out.push(n);
  });
  return out;
}
