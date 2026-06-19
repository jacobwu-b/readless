import { kv } from "@vercel/kv";

/**
 * The Vercel KV keyspace, owned solely by this module (ADR-0002). KV has no schema,
 * so these keys *are* the schema and are load-bearing — every consumer encodes them,
 * making later change a migration. Keep the surface minimal.
 *
 * - `brief:{slug}`        → the full serialized Brief JSON
 * - `briefs:index`        → a set of slugs, used to list the gallery
 * - `cache:{key}`         → slug, mapping a normalized (title|author) request for dedup
 */
export const keys = {
  brief: (slug: string) => `brief:${slug}`,
  index: "briefs:index",
  cache: (key: string) => `cache:${key}`,
} as const;

/**
 * The slice of `@vercel/kv` these helpers depend on. Narrowing the client to an
 * interface lets tests inject an in-memory store, and keeps the real datastore the
 * default — `lib/kv.ts` stays the sole importer of `@vercel/kv` (CLAUDE.md §6).
 */
export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
}

// The real `kv` exposes a superset of `KVClient`; widen through `unknown` so its
// richer generic signatures (extra optional args, broader return types) don't trip
// structural assignment. Behaviour is unchanged — only the four methods above run.
const defaultClient = kv as unknown as KVClient;

/** Read a JSON value by key. Returns `null` when the key is absent. */
export async function get<T>(key: string, client: KVClient = defaultClient): Promise<T | null> {
  return client.get<T>(key);
}

/** Write a JSON value by key, overwriting any existing value. */
export async function set(
  key: string,
  value: unknown,
  client: KVClient = defaultClient
): Promise<void> {
  await client.set(key, value);
}

/** Add a slug to the gallery index. Idempotent — the index is a set. */
export async function addToIndex(slug: string, client: KVClient = defaultClient): Promise<void> {
  await client.sadd(keys.index, slug);
}

/** List every slug in the gallery index. Order is unspecified. */
export async function list(client: KVClient = defaultClient): Promise<string[]> {
  return client.smembers(keys.index);
}
