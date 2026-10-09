/** Shapes of the JSON files written by `pnpm data:export` (pipeline/ons/export.py, docs/01-architecture.md §5). */

export type Span = { start: string; end: string };

/** One comparison (pipeline/ons/metrics.py `change`). */
export type Change = {
  s: "ok" | "small" | "zero" | "missing";
  abs?: number;
  pct?: number;
};

export type PeriodChange = Change & { period: string | null; value: number | null };

export type Metrics = {
  latest: { period: string; value: number };
  newest: string;
  prev: PeriodChange;
  yoy: PeriodChange;
  roll?: Change & { from: string | null; to: string; cur: number | null; base: number | null };
  basis: "roll" | "yoy";
  trend: "up" | "down" | "flat" | "small" | "na";
  avg5y: Change & { value: number | null; n: number };
  pctile5y: number | null;
  high12m: { period: string; value: number };
  low12m: { period: string; value: number };
};

export type Series = { v: (number | null)[]; m: Metrics | null; derived?: true };

export type OccupationShard = {
  soc: string;
  name: string;
  slug: string;
  group: string;
  months: Span;
  quarters: Span;
  monthly: Record<string, Series>;
  quarterly: Record<string, Series>;
};

export type GroupShard = {
  soc: string;
  name: string;
  slug: string;
  months: Span;
  monthly: Record<string, Series>;
};

export type PlaceType = "uk" | "region" | "lad";

export type SearchIndex = {
  occupations: { soc: string; name: string; slug: string; group: string }[];
  groups: Record<string, { name: string; slug: string }>;
  places: { code: string; name: string; slug: string; type: PlaceType; region: string | null }[];
};

export type NoticeKind = "not_collected" | "withheld" | "estimated" | "caution";

export type Notice = {
  heading: string;
  kind: NoticeKind;
  reason: string;
  months: string[];
  quarters: string[];
  ons: string;
};

export type Meta = {
  importId: number;
  releaseLabel: string; // "January 2017 - August 2026"
  publishedOn: string; // "2026-09-25"
  latestMonth: string; // "2026-08"
  latestQuarter: string; // "2026-Q2"
  withheldEverywhere: string[];
  notices: Notice[];
};
