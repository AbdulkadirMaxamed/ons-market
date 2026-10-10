/**
 * Builds the result page's data from the shards (docs/01-architecture.md §1, "Data cadence").
 *
 *   Monthly   UK / region / London: the exact job (Table 3).  Local authority: the broader 3-digit group (Table 4).
 *   Quarterly every place: the exact job. Local authorities and London come from Table 5; the UK and other regions
 *             add up whole quarters of Table 3 (`derived`).
 *
 * Only the selected place's series and a short list of comparison places go to the browser.
 */

import type { GroupShard, Metrics, OccupationShard, PlaceType, SearchIndex, Series, Span } from "./types";

export type Cadence = "M" | "Q";

export type PlaceRow = {
  code: string;
  name: string;
  slug: string;
  me: boolean;
  period: string; // the newest period of the list
  value: number | null; // null: ONS gave no figure for `period`
  change: Metrics["yoy"] | NonNullable<Metrics["roll"]> | null;
};

export type View = {
  cadence: Cadence;
  job: { code: string; name: string };
  broader: boolean; // Monthly view of a local authority shows the 3-digit group
  derived: boolean; // quarterly sums of ONS monthly figures
  span: Span;
  values: (number | null)[];
  m: Metrics | null;
  places: PlaceRow[];
};

const PLACES_SHOWN = 6;

type Place = SearchIndex["places"][number];

export function placeName(p: Pick<Place, "name">): string {
  return p.name.replace(/, City of$/, "").replace(/^City of /, "");
}

function peers(index: SearchIndex, place: Place): Set<string> {
  // Local authorities are compared with other local authorities and London (which ONS reports as one area);
  // the UK and regions with the regions.
  const lad = place.type === "lad";
  return new Set(index.places.filter((p) => (lad ? p.type === "lad" || p.code === "TLI" : p.type === "region")).map((p) => p.code));
}

function placeRows(series: Record<string, Series>, index: SearchIndex, place: Place, newest: string): PlaceRow[] {
  const allowed = peers(index, place);
  const byCode = new Map(index.places.map((p) => [p.code, p]));
  const rows = Object.entries(series)
    .filter(([code]) => allowed.has(code) || code === place.code)
    .map(([code, s]) => ({ code, s, size: s.m?.latest.value ?? -1 }))
    .sort((a, b) => b.size - a.size);
  const me = place.type === "uk" ? undefined : rows.find((r) => r.code === place.code); // the UK page lists regions
  const top = rows.filter((r) => r.code !== place.code).slice(0, me ? PLACES_SHOWN - 1 : PLACES_SHOWN);
  const picked = me ? [...top, me].sort((a, b) => b.size - a.size) : top;
  return picked.map(({ code, s }) => {
    const p = byCode.get(code)!;
    const current = s.m && s.m.latest.period === newest ? s.m : null;
    return {
      code,
      name: placeName(p),
      slug: p.slug,
      me: code === place.code,
      period: newest,
      value: current ? current.latest.value : null,
      change: current ? (current.basis === "roll" && current.roll ? current.roll : current.yoy) : null,
    };
  });
}

function view(
  cadence: Cadence,
  job: { code: string; name: string },
  span: Span,
  series: Record<string, Series>,
  index: SearchIndex,
  place: Place,
  broader: boolean,
): View | null {
  const s = series[place.code];
  if (!s) return null;
  return {
    cadence,
    job,
    broader,
    derived: !!s.derived,
    span,
    values: s.v,
    m: s.m,
    places: placeRows(series, index, place, span.end),
  };
}

export function marketViews(
  occupation: OccupationShard,
  group: GroupShard | null,
  index: SearchIndex,
  place: Place & { type: PlaceType },
): Record<Cadence, View | null> {
  const exact = { code: occupation.soc, name: occupation.name };
  const monthly =
    place.type === "lad"
      ? group && view("M", { code: group.soc, name: group.name }, group.months, group.monthly, index, place, true)
      : view("M", exact, occupation.months, occupation.monthly, index, place, false);
  return {
    M: monthly ?? null,
    Q: view("Q", exact, occupation.quarters, occupation.quarterly, index, place, false),
  };
}
