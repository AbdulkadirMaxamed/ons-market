/** Numbers, periods and wording shared by every page. Pure functions; no data loading. */

import type { Change } from "./types";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const QUARTER_LONG = ["January–March", "April–June", "July–September", "October–December"];
const QUARTER_MID = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

export const MIN_VOLUME = 30; // must match pipeline/ons/metrics.py
export const TREND_THRESHOLD = 10;

export function fmt(n: number | null | undefined): string {
  return n == null ? "–" : Math.round(n).toLocaleString("en-GB");
}

export function fmtPct(pct: number, digits = 1): string {
  return Math.abs(pct).toFixed(digits);
}

/** "2026-09-25" → "25 September 2026", without time zones (a Date would shift it a day west of the UK). */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH[m - 1]} ${y}`;
}

export const isQuarter = (p: string) => p.includes("Q");

/** "2026-08" → next "2026-09"; "2026-Q4" → "2027-Q1". */
export function nextPeriod(p: string): string {
  const [y, rest] = p.split("-");
  const year = Number(y);
  if (rest.startsWith("Q")) {
    const q = Number(rest.slice(1));
    return `${year + (q === 4 ? 1 : 0)}-Q${(q % 4) + 1}`;
  }
  const m = Number(rest);
  return `${year + (m === 12 ? 1 : 0)}-${String((m % 12) + 1).padStart(2, "0")}`;
}

export function periodsBetween(start: string, end: string): string[] {
  const out = [start];
  while (out[out.length - 1] !== end) {
    if (out.length > 1000) throw new Error(`Bad period span ${start}…${end}`);
    out.push(nextPeriod(out[out.length - 1]));
  }
  return out;
}

/**
 * Period labels.
 *   long  "August 2026" · "April–June 2026"
 *   mid   "Aug 2026"    · "Apr–Jun 2026"
 *   short "Aug"         · "Q2 2026"
 */
export function periodLabel(p: string, style: "long" | "mid" | "short" = "mid"): string {
  const [y, rest] = p.split("-");
  if (rest.startsWith("Q")) {
    const q = Number(rest.slice(1)) - 1;
    if (style === "long") return `${QUARTER_LONG[q]} ${y}`;
    if (style === "mid") return `${QUARTER_MID[q]} ${y}`;
    return `Q${q + 1} ${y}`;
  }
  const m = Number(rest) - 1;
  if (style === "long") return `${MONTH[m]} ${y}`;
  if (style === "mid") return `${MON[m]} ${y}`;
  return MON[m];
}

/** "Jun–Aug" for a 3-month window; adds years when it spans two ("Dec 2025–Feb 2026"). */
export function windowLabel(from: string, to: string): string {
  return from.slice(0, 4) === to.slice(0, 4)
    ? `${periodLabel(from, "short")}–${periodLabel(to, "short")}`
    : `${periodLabel(from, "mid")}–${periodLabel(to, "mid")}`;
}

/** ONS 3-digit names are Title Case ("Information Technology Professionals"); make them sentence case, keep acronyms. */
export function sentenceCase(name: string): string {
  return name
    .split(" ")
    .map((w, i) => (i === 0 || /^[A-Z]{2,}[,.]?$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

export type Direction = "up" | "down" | "flat" | "na";

export function direction(c: Change | null | undefined): Direction {
  if (!c || c.s !== "ok" || c.pct == null) return "na";
  if (Math.abs(c.pct) < 0.05) return "flat";
  return c.pct > 0 ? "up" : "down";
}

export const ARROW: Record<Direction, string> = { up: "▲", down: "▼", flat: "►", na: "·" };

export const TREND: Record<string, { icon: string; word: string; tone: Direction }> = {
  up: { icon: "▲", word: "Growing", tone: "up" },
  down: { icon: "▼", word: "Shrinking", tone: "down" },
  flat: { icon: "►", word: "Steady", tone: "flat" },
  small: { icon: "·", word: "Too few to tell", tone: "na" },
  na: { icon: "·", word: "Not enough data", tone: "na" },
};
