/**
 * Matching typed text to jobs and places (homepage search). Pure, so the browser and the no-JavaScript fallback
 * on the server rank results the same way. Jobs match on the friendly name, ONS's name and everyday aliases (S-003).
 */

import type { SearchIndex } from "./types";

export type JobItem = SearchIndex["occupations"][number];
export type PlaceItem = SearchIndex["places"][number];

/** Lower case, "&" → "and", punctuation → spaces. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Rough English stem so "developer" finds "development", "nurse" finds "nurses", "teacher" finds "teaching".
const SUFFIXES = ["ments", "ment", "ings", "ing", "ers", "er", "ists", "ist", "ians", "ian", "ors", "or", "es", "s"];
export function stem(word: string): string {
  for (const s of SUFFIXES) if (word.length - s.length >= 4 && word.endsWith(s)) return word.slice(0, -s.length);
  return word;
}

const STOP = new Set(["and", "of", "the", "in", "for", "a"]);

function score(name: string, query: string): number {
  const n = normalise(name);
  const q = normalise(query);
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q + " ")) return 85;
  const words = n.split(" ");
  const tokens = q.split(" ").filter((t) => !STOP.has(t));
  if (tokens.length === 0) return 0;
  // Per typed word: 3 = the word itself or its plural, 2 = same stem ("developer" ~ "development"), 1 = prefix.
  const quality = (t: string) =>
    Math.max(
      0,
      ...words.map((w) =>
        w === t || w === `${t}s` || w === `${t}es` ? 3 : stem(w) === stem(t) ? 2 : w.startsWith(t) || stem(w).startsWith(stem(t)) ? 1 : 0,
      ),
    );
  const qs = tokens.map(quality);
  const leads = stem(words[0]) === stem(tokens[0]) || words[0].startsWith(tokens[0]) ? 5 : 0; // "Cleaners and …" first
  if (qs.every((x) => x > 0)) return 40 + (10 * qs.reduce((a, b) => a + b, 0)) / qs.length + leads - Math.min(15, words.length);
  if (q.length >= 3 && n.includes(q)) return 20;
  return 0;
}

function rank<T>(
  items: T[],
  query: string,
  name: (x: T) => string,
  extra?: (x: T, q: string) => number,
  limit = 8,
  pop: (x: T) => number = () => 0,
): T[] {
  return items
    .map((x, i) => {
      const n = score(name(x), query);
      return { x, i, n, s: Math.max(n, extra?.(x, query) ?? 0) };
    })
    .filter((r) => r.s > 0)
    // Ties (e.g. every job with the alias "nurse") go to the most advertised job, then the best match on the shown
    // name, then the shortest.
    .sort((a, b) => b.s - a.s || pop(a.x) - pop(b.x) || b.n - a.n || name(a.x).length - name(b.x).length || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.x);
}

/** Score from what isn't the shown name: a SOC code, an alias ("sparky"), or ONS's official name. */
function jobExtra(j: JobItem, query: string): number {
  const q = query.trim();
  if (/^\d{2,4}$/.test(q)) return j.soc.startsWith(q) ? 90 : 0; // "2134" goes to that job
  const nq = normalise(q);
  const aliases = j.aliases ?? [];
  // A typed alias ranks just under an exact name; a partial alias match counts for less than a partial name match.
  const alias = aliases.some((a) => normalise(a) === nq) ? 92 : Math.max(0, ...aliases.map((a) => score(a, q) - 10));
  return Math.max(alias, j.ons ? score(j.ons, q) - 2 : 0);
}

export function findJobs(jobs: JobItem[], query: string, limit?: number): JobItem[] {
  return rank(jobs, query, (j) => j.name, jobExtra, limit, (j) => j.pop ?? Infinity);
}

/** A job by its URL slug, or by the slug it had before its friendly name (`moved`: redirect to the new URL). */
export function jobBySlug(jobs: JobItem[], slug: string | undefined): { job: JobItem; moved: boolean } | undefined {
  if (!slug) return undefined;
  const job = jobs.find((o) => o.slug === slug);
  if (job) return { job, moved: false };
  const old = jobs.find((o) => o.old === slug);
  return old && { job: old, moved: true };
}

export function findPlaces(places: PlaceItem[], query: string, limit?: number): PlaceItem[] {
  const q = normalise(query);
  const extra = (p: PlaceItem) => (p.type === "uk" && ["uk", "united kingdom", "britain", "great britain"].includes(q) ? 100 : 0);
  return rank(places, query, (p) => p.name, extra, limit);
}

/** Second line under a place in the suggestions. */
export function placeHint(p: PlaceItem, index: Pick<SearchIndex, "places">): string {
  if (p.type === "uk") return "Whole country";
  if (p.type === "region") return p.code === "TLI" ? "Region (all London boroughs)" : "Region";
  return index.places.find((r) => r.code === p.region)?.name ?? "Local authority";
}

export type Resolved =
  | { ok: true; href: string }
  | { ok: false; field: "job" | "where"; message: string };

/**
 * Turn what was typed (or picked) into a result page. An empty place means the whole UK.
 * `jobSlug` / `whereSlug` are set when the person picked from the list.
 */
export function resolveSearch(
  index: SearchIndex,
  input: { job?: string | null; where?: string | null; jobSlug?: string | null; whereSlug?: string | null },
): Resolved {
  const jobText = input.job?.trim() ?? "";
  const whereText = input.where?.trim() ?? "";
  const job =
    (input.jobSlug && jobBySlug(index.occupations, input.jobSlug)?.job) ||
    (jobText ? findJobs(index.occupations, jobText, 1)[0] : undefined);
  if (!jobText && !input.jobSlug) return { ok: false, field: "job", message: "Type a job to check, for example “nurse”." };
  if (!job) return { ok: false, field: "job", message: `We couldn’t find a job matching “${jobText}”. Try a different word.` };

  const place =
    (input.whereSlug && index.places.find((p) => p.slug === input.whereSlug)) ||
    (whereText ? findPlaces(index.places, whereText, 1)[0] : index.places.find((p) => p.type === "uk"));
  if (!place) {
    return { ok: false, field: "where", message: `We couldn’t find a UK area matching “${whereText}”. Try a town, city or region.` };
  }
  return { ok: true, href: `/market/${job.slug}/${place.slug}` };
}
