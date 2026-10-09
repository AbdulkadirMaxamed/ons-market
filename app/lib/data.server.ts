import { env } from "cloudflare:workers";

/**
 * The only module that knows where the exported data lives.
 * Shards are static files in public/data/, written by `pnpm data:export` (docs/01-architecture.md §5).
 * Returns null when a shard doesn't exist, e.g. before the first import or for an unknown code.
 */
export async function loadShard<T>(request: Request, path: string): Promise<T | null> {
  // Resolve against the incoming request's origin: the dev server's assets proxy rejects other hosts.
  const res = await env.ASSETS.fetch(new URL(`/data/${path}`, request.url));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't read data/${path} (HTTP ${res.status})`);
  return (await res.json()) as T;
}

/** meta.json: what release the site is showing. */
export type Meta = {
  releaseLabel: string; // "January 2017 - August 2026"
  publishedOn: string; // "2026-09-25"
  latestMonth: string; // "2026-08"
  latestQuarter: string; // "2026-Q2"
};
