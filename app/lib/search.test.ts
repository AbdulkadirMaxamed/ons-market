import { describe, expect, it } from "vitest";

import { findJobs, findPlaces, normalise, placeHint, resolveSearch, stem } from "./search";
import type { SearchIndex } from "./types";

const index: SearchIndex = {
  occupations: [
    { soc: "2134", name: "Programmers and software development professionals", slug: "programmers", group: "213" },
    { soc: "2231", name: "Midwifery nurses", slug: "midwifery-nurses", group: "223" },
    { soc: "2311", name: "Nursery education teaching professionals", slug: "nursery", group: "231" },
    { soc: "9223", name: "Cleaners and domestics", slug: "cleaners", group: "922" },
    { soc: "9229", name: "Window cleaners", slug: "window-cleaners", group: "922" },
    { soc: "2493", name: "Chartered and certified accountants", slug: "accountants", group: "249" },
  ],
  groups: {},
  places: [
    { code: "K02000001", name: "United Kingdom", slug: "united-kingdom", type: "uk", region: null },
    { code: "TLD", name: "North West", slug: "north-west", type: "region", region: null },
    { code: "TLI", name: "London", slug: "london", type: "region", region: null },
    { code: "E08000003", name: "Manchester", slug: "manchester", type: "lad", region: "TLD" },
    { code: "E06000014", name: "York", slug: "york", type: "lad", region: "TLE" },
    { code: "TLE", name: "Yorkshire and The Humber", slug: "yorkshire-and-the-humber", type: "region", region: null },
  ],
};
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("matching", () => {
  it("normalises punctuation and ampersands", () => {
    expect(normalise("  Bus & Coach-Drivers ")).toBe("bus and coach drivers");
  });
  it("stems common endings", () => {
    expect(stem("developer")).toBe(stem("development"));
    expect(stem("teachers")).toBe(stem("teaching"));
  });
  it("finds jobs by everyday words, stems and SOC code", () => {
    expect(names(findJobs(index.occupations, "software developer"))).toEqual([
      "Programmers and software development professionals",
    ]);
    expect(names(findJobs(index.occupations, "2134"))).toEqual(["Programmers and software development professionals"]);
    expect(names(findJobs(index.occupations, "accountant"))).toEqual(["Chartered and certified accountants"]);
  });
  it("prefers whole words over prefixes, and names that start with the word", () => {
    expect(names(findJobs(index.occupations, "nurse"))[0]).toBe("Midwifery nurses");
    expect(names(findJobs(index.occupations, "cleaner"))).toEqual(["Cleaners and domestics", "Window cleaners"]);
  });
  it("finds places, exact names first, and the UK by common names", () => {
    expect(names(findPlaces(index.places, "york"))).toEqual(["York", "Yorkshire and The Humber"]);
    expect(names(findPlaces(index.places, "UK"))).toEqual(["United Kingdom"]);
    expect(findPlaces(index.places, "zzz")).toEqual([]);
  });
  it("describes places", () => {
    expect(placeHint(index.places[3], index)).toBe("North West");
    expect(placeHint(index.places[2], index)).toBe("Region (all London boroughs)");
    expect(placeHint(index.places[0], index)).toBe("Whole country");
  });
});

describe("resolveSearch", () => {
  it("uses the picked items when there are any", () => {
    expect(resolveSearch(index, { job: "whatever", jobSlug: "cleaners", whereSlug: "london" })).toEqual({
      ok: true,
      href: "/market/cleaners/london",
    });
  });
  it("takes the best match for typed text, and the UK when no place is given", () => {
    expect(resolveSearch(index, { job: "software developer", where: "manchester" })).toEqual({
      ok: true,
      href: "/market/programmers/manchester",
    });
    expect(resolveSearch(index, { job: "nurse", where: "" })).toEqual({ ok: true, href: "/market/midwifery-nurses/united-kingdom" });
  });
  it("explains what went wrong", () => {
    expect(resolveSearch(index, { job: "", where: "leeds" })).toMatchObject({ ok: false, field: "job" });
    expect(resolveSearch(index, { job: "astronaut" })).toMatchObject({
      ok: false,
      field: "job",
      message: "We couldn’t find a job matching “astronaut”. Try a different word.",
    });
    expect(resolveSearch(index, { job: "nurse", where: "Atlantis" })).toMatchObject({ ok: false, field: "where" });
  });
});
