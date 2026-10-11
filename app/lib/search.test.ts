import { describe, expect, it } from "vitest";

import { findJobs, findPlaces, jobBySlug, normalise, placeHint, resolveSearch, stem, type JobItem } from "./search";
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

describe("friendly names and aliases (S-003)", () => {
  const job = (soc: string, name: string, extra: Partial<JobItem> = {}): JobItem => ({ soc, name, slug: name.toLowerCase().replace(/\W+/g, "-"), group: soc.slice(0, 3), ...extra });
  const jobs: JobItem[] = [
    job("2134", "Software developers", { ons: "Programmers and software development professionals", aliases: ["software engineer", "programmer", "dev"], old: "programmers-and-software-development-professionals" }),
    job("5241", "Electricians", { ons: "Electricians and electrical fitters", aliases: ["electrician", "sparky"] }),
    job("2231", "Midwives", { ons: "Midwifery nurses", aliases: ["midwife", "nurse"] }),
    job("2232", "Community nurses", { ons: "Registered community nurses", aliases: ["nurse", "district nurse"] }),
    job("6111", "Nursery assistants", { ons: "Early education and childcare assistants" }),
    job("2123", "Electrical engineers", { aliases: ["engineer"] }),
  ];

  it("finds a job by an everyday word", () => {
    expect(findJobs(jobs, "sparky")[0].soc).toBe("5241");
    expect(findJobs(jobs, "software engineer")[0].soc).toBe("2134");
    expect(findJobs(jobs, "dev")[0].soc).toBe("2134");
  });
  it("still finds a job by ONS's official name", () => {
    expect(findJobs(jobs, "programmers and software")[0].soc).toBe("2134");
    expect(findJobs(jobs, "electrical fitters")[0].soc).toBe("5241");
  });
  it("breaks alias ties on the shown name: nurses, then midwives, then the weak \"nursery\" prefix match", () => {
    expect(findJobs(jobs, "nurse").map((j) => j.soc)).toEqual(["2232", "2231", "6111"]);
  });
  it("orders equally good matches by how many adverts the job has", () => {
    const popular = jobs.map((j) => ({ ...j, pop: j.soc === "2231" ? 1 : 2 }));
    expect(findJobs(popular, "nurse").map((j) => j.soc).slice(0, 2)).toEqual(["2231", "2232"]);
  });
  it("an exact name beats an alias", () => {
    expect(findJobs(jobs, "electricians")[0].soc).toBe("5241");
  });
  it("finds a job by its old URL and says it moved", () => {
    expect(jobBySlug(jobs, "software-developers")).toEqual({ job: jobs[0], moved: false });
    expect(jobBySlug(jobs, "programmers-and-software-development-professionals")).toEqual({ job: jobs[0], moved: true });
    expect(jobBySlug(jobs, "nope")).toBeUndefined();
  });
  it("resolves a picked old slug to the new URL", () => {
    const friendly: SearchIndex = { occupations: jobs, groups: {}, places: index.places };
    expect(resolveSearch(friendly, { jobSlug: "programmers-and-software-development-professionals", where: "Manchester" }))
      .toEqual({ ok: true, href: "/market/software-developers/manchester" });
  });
});
