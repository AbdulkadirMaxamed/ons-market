import { env } from "cloudflare:workers";

export type * from "./types";

/**
 * The only module that knows where the exported data lives.
 * Shards are static files in public/data/, written by `pnpm data:export` (docs/01-architecture.md §5).
 * Returns null when a shard doesn't exist, e.g. before the first import or for an unknown code.
 *
 * Parsed shards are kept in memory for the life of the Worker isolate: they only change on deploy, which starts
 * a new isolate, and re-parsing a 300 KB file on every request would eat into the free plan's CPU budget.
 */
const CACHE_LIMIT = 24;
const cache = new Map<string, Promise<unknown>>();

export function loadShard<T>(request: Request, path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T | null>;
  const pending = fetchShard<T>(request, path);
  cache.set(path, pending);
  pending.catch(() => cache.delete(path)); // don't remember failures
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return pending;
}

async function fetchShard<T>(request: Request, path: string): Promise<T | null> {
  // Resolve against the incoming request's origin: the dev server's assets proxy rejects other hosts.
  const res = await env.ASSETS.fetch(new URL(`/data/${path}`, request.url));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Couldn't read data/${path} (HTTP ${res.status})`);
  return (await res.json()) as T;
}
