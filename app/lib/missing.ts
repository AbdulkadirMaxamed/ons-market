/**
 * Why a figure is missing or estimated (S-010, collages 8A · 9C · 11D).
 * Reasons come from pipeline/notices.toml via meta.json; ONS's own text is in `notice.ons`.
 */

import { periodLabel } from "./format";
import type { Notice } from "./types";

export type MissingKind = "not_collected" | "withheld" | "unpublished" | "not_found";

export type Missing = {
  kind: MissingKind;
  label: string;
  reason: string;
  source?: string; // "ONS, data issue: March 2026"
};

export const LABEL: Record<MissingKind, string> = {
  not_collected: "Data not collected",
  withheld: "Withheld by ONS",
  unpublished: "Not published yet",
  not_found: "Not found",
};

const covers = (n: Notice, period: string) => (period.includes("Q") ? n.quarters : n.months).includes(period);

export function sourceOf(n: Notice): string {
  return `ONS, data issue: ${n.heading.replace(/^Data issue\s*-\s*(data for\s+)?/i, "").replace(/\s+data$/i, "")}`;
}

/** Reason for a period ONS published with no figure (`[x]`). "Not collected" wins over "withheld". */
export function missingFor(period: string, notices: Notice[]): Missing {
  const hit =
    notices.find((n) => n.kind === "not_collected" && covers(n, period)) ??
    notices.find((n) => n.kind === "withheld" && covers(n, period));
  if (!hit) {
    return { kind: "withheld", label: LABEL.withheld, reason: "ONS withheld this figure over data quality." };
  }
  return { kind: hit.kind as MissingKind, label: LABEL[hit.kind as MissingKind], reason: hit.reason, source: sourceOf(hit) };
}

/** A period after the latest release (e.g. the quarter in progress). */
export function unpublished(period: string): Missing {
  return { kind: "unpublished", label: LABEL.unpublished, reason: `ONS hasn’t published ${periodLabel(period, "mid")} yet.` };
}

export function notFound(job: string, place: string): Missing {
  return {
    kind: "not_found",
    label: LABEL.not_found,
    reason: `ONS doesn’t publish figures for ${job.toLowerCase()} in ${place}.`,
    source: "ONS tables",
  };
}

/** ONS partly estimated this period (shown in the numbers table only, 11D). */
export function estimatedFor(period: string, notices: Notice[]): Notice | undefined {
  return notices.find((n) => n.kind === "estimated" && covers(n, period));
}
