import { kv } from "@vercel/kv";

/**
 * The Vercel KV keyspace, owned solely by this module (ADR-0002, ADR-0005). KV has
 * no schema, so these keys *are* the schema and are load-bearing — every consumer
 * encodes them, making later change a migration. Keep the surface minimal.
 *
 * - `brief:{slug}`        → the full serialized Brief JSON
 * - `briefs:gallery`      → a hash of slug → IndexEntry JSON, the gallery's one-read source (ADR-0005)
 * - `briefs:index`        → legacy slug set, retired by ADR-0005; read only by the migration backfill
 * - `cache:{key}`         → slug, mapping a normalized (title|author) request for dedup
 * - `rl:ip:{ip}:{day}`    → per-IP daily request counter (TTL'd, ADR-0003)
 * - `rl:global:{day}`     → global daily request counter, the spend backstop (ADR-0003)
 */
export const keys = {
  brief: (slug: string) => `brief:${slug}`,
  gallery: "briefs:gallery",
  index: "briefs:index",
  cache: (key: string) => `cache:${key}`,
  rlIp: (ip: string, day: string) => `rl:ip:${ip}:${day}`,
  rlGlobal: (day: string) => `rl:global:${day}`,
} as const;

/**
 * The slice of `@vercel/kv` these helpers depend on. Narrowing the client to an
 * interface lets tests inject an in-memory store, and keeps the real datastore the
 * default — `lib/kv.ts` stays the sole importer of `@vercel/kv` (CLAUDE.md §6).
 */
export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  hset(key: string, value: Record<string, unknown>): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  hkeys(key: string): Promise<string[]>;
  // Retired by ADR-0005 — kept only so the gallery-index migration can read the legacy set.
  smembers(key: string): Promise<string[]>;
}

/**
 * The counter slice of `@vercel/kv`, kept separate from `KVClient` so the brief-store
 * consumers and their fakes don't carry methods they never use. `lib/ratelimit.ts`
 * drives daily counters through this; tests inject an in-memory stand-in.
 */
export interface CounterClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

// The real `kv` exposes a superset of `KVClient`; widen through `unknown` so its
// richer generic signatures (extra optional args, broader return types) don't trip
// structural assignment. Behaviour is unchanged — only the four methods above run.
const defaultClient = kv as unknown as KVClient;

// Same widening for the counter ops — `kv.incr`/`kv.expire` exist on the real client.
const defaultCounterClient = kv as unknown as CounterClient;

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

/**
 * Upsert a slug's gallery projection into the `briefs:gallery` hash (ADR-0005).
 * Idempotent — re-writing a slug overwrites its field rather than duplicating it.
 */
export async function addToIndex(
  slug: string,
  entry: unknown,
  client: KVClient = defaultClient
): Promise<void> {
  await client.hset(keys.gallery, { [slug]: entry });
}

/**
 * Read the whole gallery index as a slug → entry map in one call — the O(1) read
 * that lets `listBriefs` skip per-slug full-brief fetches. Empty when the index is unset.
 */
export async function listIndex<T>(client: KVClient = defaultClient): Promise<Record<string, T>> {
  return ((await client.hgetall(keys.gallery)) as Record<string, T> | null) ?? {};
}

/** List every slug present in the gallery index. Order is unspecified. */
export async function indexSlugs(client: KVClient = defaultClient): Promise<string[]> {
  return client.hkeys(keys.gallery);
}

/**
 * Read the retired `briefs:index` slug set. Transitional: used only by the
 * gallery-index backfill (ADR-0005) and removed with the follow-up cleanup.
 */
export async function legacyIndexSlugs(client: KVClient = defaultClient): Promise<string[]> {
  return client.smembers(keys.index);
}

/** Atomically increment a counter, returning its new value. Creates it at 1 if absent. */
export async function incr(
  key: string,
  client: CounterClient = defaultCounterClient
): Promise<number> {
  return client.incr(key);
}

/** Set a key's time-to-live in seconds, so a counter's window self-expires. */
export async function expire(
  key: string,
  seconds: number,
  client: CounterClient = defaultCounterClient
): Promise<void> {
  await client.expire(key, seconds);
}
