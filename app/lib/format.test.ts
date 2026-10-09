import { describe, expect, it } from "vitest";

import { dateLabel, direction, fmt, fmtPct, nextPeriod, periodLabel, periodsBetween, sentenceCase, windowLabel } from "./format";

describe("numbers", () => {
  it("formats counts the UK way and shows missing as a dash", () => {
    expect(fmt(720638)).toBe("720,638");
    expect(fmt(0)).toBe("0");
    expect(fmt(null)).toBe("–");
  });
  it("keeps one decimal on percentages", () => {
    expect(fmtPct(-7)).toBe("7.0");
    expect(fmtPct(18.6)).toBe("18.6");
  });
});

describe("periods", () => {
  it("steps months and quarters across year ends", () => {
    expect(nextPeriod("2025-12")).toBe("2026-01");
    expect(nextPeriod("2026-08")).toBe("2026-09");
    expect(nextPeriod("2025-Q4")).toBe("2026-Q1");
  });
  it("expands a span", () => {
    expect(periodsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(periodsBetween("2017-Q1", "2026-Q2")).toHaveLength(38);
  });
  it("refuses a span that never ends", () => {
    expect(() => periodsBetween("2026-02", "2026-01")).toThrow("Bad period span");
  });
  it("labels months and quarters", () => {
    expect(periodLabel("2026-08", "long")).toBe("August 2026");
    expect(periodLabel("2026-08")).toBe("Aug 2026");
    expect(periodLabel("2026-08", "short")).toBe("Aug");
    expect(periodLabel("2026-Q2", "long")).toBe("April–June 2026");
    expect(periodLabel("2026-Q2")).toBe("Apr–Jun 2026");
  });
  it("formats the publication date without time zones", () => {
    expect(dateLabel("2026-09-25")).toBe("25 September 2026");
  });
  it("labels the 3-month window", () => {
    expect(windowLabel("2026-06", "2026-08")).toBe("Jun–Aug");
    expect(windowLabel("2025-12", "2026-02")).toBe("Dec 2025–Feb 2026");
  });
});

describe("wording", () => {
  it("sentence-cases ONS group names but keeps acronyms", () => {
    expect(sentenceCase("Information Technology Professionals")).toBe("Information technology professionals");
    expect(sentenceCase("CAD, Drawing and Architectural Technicians")).toBe("CAD, drawing and architectural technicians");
  });
  it("only gives a direction for a usable comparison", () => {
    expect(direction({ s: "ok", pct: -18.6 })).toBe("down");
    expect(direction({ s: "ok", pct: 3 })).toBe("up");
    expect(direction({ s: "ok", pct: 0 })).toBe("flat");
    expect(direction({ s: "small", abs: 4 })).toBe("na");
    expect(direction({ s: "missing" })).toBe("na");
    expect(direction(null)).toBe("na");
  });
});
