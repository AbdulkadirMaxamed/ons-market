import { describe, expect, it } from "vitest";

import { estimatedFor, LABEL, missingFor, noticePeriods, noticesByKind, notFound, sourceOf, unpublished } from "./missing";
import type { Notice } from "./types";

const notice = (n: Partial<Notice>): Notice => ({ heading: "", kind: "withheld", reason: "", months: [], quarters: [], ons: "", ...n });

const NOTICES: Notice[] = [
  notice({ heading: "Data issue - data for October 2025 - July 2026", kind: "estimated", months: ["2026-02"], quarters: ["2026-Q1"], reason: "Partly estimated." }),
  notice({ heading: "Data issue - March 2026", kind: "not_collected", months: ["2026-03"], quarters: ["2026-Q1"], reason: "Couldn't get data." }),
  notice({ heading: "Data issue - February 2026", kind: "withheld", months: ["2026-02"], reason: "A source dropped out." }),
  notice({ heading: "Data issue - January 2017 data", kind: "caution", months: ["2017-01"], reason: "First month." }),
];

describe("missingFor", () => {
  it("uses the label per cause (8A)", () => {
    expect(missingFor("2026-03", NOTICES)).toEqual({
      kind: "not_collected",
      label: "Data not collected",
      reason: "Couldn't get data.",
      source: "ONS, data issue: March 2026",
    });
    expect(missingFor("2026-02", NOTICES).label).toBe("Withheld by ONS");
  });
  it("matches quarters against the quarters list", () => {
    expect(missingFor("2026-Q1", NOTICES).kind).toBe("not_collected");
  });
  it("never uses an estimated or caution notice to explain a gap", () => {
    const m = missingFor("2017-01", NOTICES);
    expect(m).toEqual({ kind: "withheld", label: LABEL.withheld, reason: "ONS withheld this figure over data quality." });
  });
});

it("labels unpublished periods and missing combinations", () => {
  expect(unpublished("2026-Q3")).toMatchObject({ label: "Not published yet", reason: "ONS hasn’t published Jul–Sep 2026 yet." });
  expect(notFound("Company secretaries", "Boston").reason).toBe("ONS doesn’t publish figures for company secretaries in Boston.");
});

it("finds estimated periods (11D)", () => {
  expect(estimatedFor("2026-02", NOTICES)?.reason).toBe("Partly estimated.");
  expect(estimatedFor("2026-04", NOTICES)).toBeUndefined();
});

it("shortens ONS headings for the source line", () => {
  expect(sourceOf(NOTICES[0])).toBe("ONS, data issue: October 2025 - July 2026");
  expect(sourceOf(NOTICES[3])).toBe("ONS, data issue: January 2017");
});

describe("noticesByKind", () => {
  it("orders not collected, withheld, estimated, caution and drops empty kinds", () => {
    expect(noticesByKind(NOTICES).map((g) => g.kind)).toEqual(["not_collected", "withheld", "estimated", "caution"]);
    expect(noticesByKind(NOTICES.filter((n) => n.kind === "caution")).map((g) => g.kind)).toEqual(["caution"]);
  });
});

describe("noticePeriods", () => {
  it("lists months and quarters", () => {
    expect(noticePeriods(NOTICES[0])).toBe("Months: Feb 2026 · Quarters: Q1 2026");
    expect(noticePeriods(NOTICES[3])).toBe("Months: Jan 2017");
  });
});
