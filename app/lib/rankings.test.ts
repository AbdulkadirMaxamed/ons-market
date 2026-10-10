import { describe, expect, it } from "vitest";

import { pageList, parseRankParams, rankHref, rankItems, type RankItem } from "./rankings";

// Made-up rows for tests only.
const item = (key: string, value: number | null, pct: number | null, s = "ok"): RankItem => ({
  key,
  name: key,
  href: null,
  value,
  change: value == null ? null : { s, pct },
  trend: "flat",
});
const ITEMS = [
  item("A", 500, -20),
  item("B", 900, 5),
  item("C", null, null), // withheld
  item("D", 20, null, "small"), // too few to compare
  item("E", 300, 40),
];
const keys = (r: { items: { key: string }[] }) => r.items.map((i) => i.key);

describe("parseRankParams", () => {
  it("defaults to Monthly, most adverts, page 1, 10 rows", () => {
    expect(parseRankParams(new URLSearchParams(""), "region")).toEqual({ view: "M", sort: "adverts", page: 1, rows: 10, filter: null });
  });
  it("accepts only 10 or 25 rows and known sorts", () => {
    const p = parseRankParams(new URLSearchParams("rows=25&sort=rise&view=quarterly&page=3&region=TLD"), "region");
    expect(p).toEqual({ view: "Q", sort: "rise", page: 3, rows: 25, filter: "TLD" });
    expect(parseRankParams(new URLSearchParams("rows=1000&sort=drop&page=-2"), "region")).toMatchObject({ rows: 10, sort: "adverts", page: 1 });
  });
});

describe("rankItems", () => {
  it("sorts by adverts with withheld figures last and unranked", () => {
    const r = rankItems(ITEMS, "adverts", 1, 10);
    expect(keys(r)).toEqual(["B", "A", "E", "D", "C"]);
    expect(r.items.map((i) => i.rank)).toEqual([1, 2, 3, 4, null]);
    expect(r.excluded).toBe(0);
  });
  it("leaves out rows without a usable comparison when sorting by change", () => {
    const rise = rankItems(ITEMS, "rise", 1, 10);
    expect(keys(rise)).toEqual(["E", "B", "A"]);
    expect(rise.excluded).toBe(2);
    expect(keys(rankItems(ITEMS, "fall", 1, 10))).toEqual(["A", "B", "E"]);
  });
  it("pages, and clamps a page number that's out of range", () => {
    const many = Array.from({ length: 23 }, (_, i) => item(`J${String(i).padStart(2, "0")}`, 100 - i, 1));
    const p3 = rankItems(many, "adverts", 3, 10);
    expect(p3).toMatchObject({ page: 3, pages: 3, from: 21, total: 23 });
    expect(p3.items).toHaveLength(3);
    expect(p3.items[0].rank).toBe(21);
    expect(rankItems(many, "adverts", 99, 10).page).toBe(3);
    expect(rankItems(many, "adverts", 1, 25).pages).toBe(1);
  });
  it("copes with an empty list", () => {
    expect(rankItems([], "adverts", 1, 10)).toMatchObject({ items: [], pages: 1, from: 0, total: 0 });
  });
});

describe("rankHref", () => {
  const sp = new URLSearchParams("view=quarterly&sort=rise&page=4&rows=25");
  it("resets to page 1 when the order changes, and drops defaults", () => {
    expect(rankHref(sp, { sort: "fall" })).toBe("?view=quarterly&sort=fall&rows=25");
    expect(rankHref(sp, { rows: 10 })).toBe("?view=quarterly&sort=rise");
    expect(rankHref(new URLSearchParams("view=quarterly"), { view: null })).toBe("?");
  });
  it("keeps everything else when only the page changes", () => {
    expect(rankHref(sp, { page: 5 })).toBe("?view=quarterly&sort=rise&page=5&rows=25");
    expect(rankHref(sp, { page: 1 })).toBe("?view=quarterly&sort=rise&rows=25");
  });
});

it("lists pages with gaps", () => {
  expect(pageList(1, 1)).toEqual([1]);
  expect(pageList(1, 11)).toEqual([1, 2, null, 11]);
  expect(pageList(6, 11)).toEqual([1, null, 5, 6, 7, null, 11]);
  expect(pageList(3, 4)).toEqual([1, 2, 3, 4]);
  expect(pageList(1, 4)).toEqual([1, 2, 3, 4]); // no "…" standing in for a single page
});
