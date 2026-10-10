import { describe, expect, it } from "vitest";

import { marketViews } from "./market.server";
import type { GroupShard, Metrics, OccupationShard, SearchIndex, Series } from "./types";

// Made-up figures for tests only.
const m = (period: string, value: number, extra: Partial<Metrics> = {}): Metrics =>
  ({
    latest: { period, value },
    newest: period,
    prev: { s: "missing", period: null, value: null },
    yoy: { s: "ok", pct: -10, abs: -10, period: "x", value: 100 },
    roll: { s: "ok", pct: -5, abs: -5, from: "a", to: period, cur: 95, base: 100 },
    basis: "roll",
    trend: "flat",
    avg5y: { s: "missing", value: null, n: 0 },
    pctile5y: null,
    high12m: { period, value },
    low12m: { period, value },
    ...extra,
  }) as Metrics;
const s = (period: string, value: number, extra: Partial<Metrics> = {}): Series => ({ v: [value], m: m(period, value, extra) });

const index: SearchIndex = {
  occupations: [{ soc: "2134", name: "Programmers", slug: "programmers", group: "213" }],
  groups: { "213": { name: "IT Professionals", slug: "it" } },
  places: [
    { code: "K02000001", name: "United Kingdom", slug: "united-kingdom", type: "uk", region: null },
    { code: "TLD", name: "North West", slug: "north-west", type: "region", region: null },
    { code: "TLI", name: "London", slug: "london", type: "region", region: null },
    { code: "E08000003", name: "Manchester", slug: "manchester", type: "lad", region: "TLD" },
    { code: "E06000023", name: "Bristol, City of", slug: "bristol", type: "lad", region: "TLK" },
  ],
};
const occupation: OccupationShard = {
  soc: "2134", name: "Programmers", slug: "programmers", group: "213",
  months: { start: "2026-08", end: "2026-08" }, quarters: { start: "2026-Q2", end: "2026-Q2" },
  monthly: { K02000001: s("2026-08", 1000), TLD: s("2026-08", 100), TLI: s("2026-08", 400) },
  quarterly: {
    K02000001: { ...s("2026-Q2", 3000), derived: true },
    TLD: { ...s("2026-Q2", 300), derived: true },
    TLI: s("2026-Q2", 1200),
    E08000003: s("2026-Q2", 90),
    E06000023: { v: [null], m: m("2026-Q1", 50) }, // newest quarter withheld
  },
};
const group: GroupShard = {
  soc: "213", name: "IT Professionals", slug: "it", months: { start: "2026-08", end: "2026-08" },
  monthly: { E08000003: s("2026-08", 150), E06000023: s("2026-08", 80), TLI: s("2026-08", 900) },
};
const place = (slug: string) => index.places.find((p) => p.slug === slug)!;

describe("marketViews", () => {
  it("local authority: monthly is the broader group, quarterly the exact job", () => {
    const v = marketViews(occupation, group, index, place("manchester"));
    expect(v.M).toMatchObject({ broader: true, job: { code: "213" }, values: [150] });
    expect(v.Q).toMatchObject({ broader: false, derived: false, job: { code: "2134" }, values: [90] });
  });

  it("compares a local authority with others and London, biggest first", () => {
    const v = marketViews(occupation, group, index, place("manchester"));
    expect(v.M!.places.map((p) => [p.name, p.me])).toEqual([["London", false], ["Manchester", true], ["Bristol", false]]);
    expect(v.M!.places[1].change).toMatchObject({ s: "ok", pct: -5 }); // 3-month window when it's the basis
  });

  it("shows no figure for a place whose newest period is withheld", () => {
    const bristol = marketViews(occupation, group, index, place("manchester")).Q!.places.find((p) => p.name === "Bristol")!;
    expect(bristol).toMatchObject({ value: null, change: null, period: "2026-Q2" });
  });

  it("region: exact job monthly, derived quarterly, compared with regions", () => {
    const v = marketViews(occupation, null, index, place("north-west"));
    expect(v.M).toMatchObject({ broader: false, values: [100] });
    expect(v.Q!.derived).toBe(true);
    expect(v.M!.places.map((p) => p.name)).toEqual(["London", "North West"]);
  });

  it("the UK page lists regions, not itself", () => {
    const v = marketViews(occupation, null, index, place("united-kingdom"));
    expect(v.M!.places.every((p) => !p.me && p.name !== "United Kingdom")).toBe(true);
  });

  it("fills all six rows when the place itself isn't listed (B-025)", () => {
    const regions = Object.fromEntries(
      ["TLC", "TLD", "TLE", "TLF", "TLG", "TLH", "TLI"].map((c, i) => [c, s("2026-08", 100 + i)]),
    );
    const many = {
      ...index,
      places: [
        index.places[0],
        ...Object.keys(regions).map((c) => ({ code: c, name: c, slug: c.toLowerCase(), type: "region" as const, region: null })),
      ],
    };
    const v = marketViews({ ...occupation, monthly: { K02000001: s("2026-08", 1000), ...regions } }, null, many, many.places[0]);
    expect(v.M!.places).toHaveLength(6);
  });

  it("returns null for a view ONS doesn't publish", () => {
    const v = marketViews({ ...occupation, quarterly: {} }, group, index, place("manchester"));
    expect(v.Q).toBeNull();
    expect(v.M).not.toBeNull();
  });
});
