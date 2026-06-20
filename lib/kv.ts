import { Redis } from "@upstash/redis";

import { isKVConfigured, kvCredentials } from "./env.js";

/**
 * The Vercel KV keyspace, owned solely by this module (ADR-0002, ADR-0005). KV has
 * no schema, so these keys *are* the schema and are load-bearing — every consumer
 * encodes them, making later change a migration. Keep the surface minimal.
 *
 * - `brief:{slug}`        → the full serialized Brief JSON
 * - `briefs:gallery`      → a hash of slug → IndexEntry JSON, the gallery's one-read source (ADR-0005)
 * - `cache:{key}`         → slug, mapping a normalized (title|author) request for dedup
 * - `rl:ip:{ip}:{day}`    → per-IP daily request counter (TTL'd, ADR-0003)
 * - `rl:global:{day}`     → global daily request counter, the spend backstop (ADR-0003)
 */
export const keys = {
  brief: (slug: string) => `brief:${slug}`,
  gallery: "briefs:gallery",
  cache: (key: string) => `cache:${key}`,
  rlIp: (ip: string, day: string) => `rl:ip:${ip}:${day}`,
  rlGlobal: (day: string) => `rl:global:${day}`,
} as const;

/**
 * The slice of `@upstash/redis` these helpers depend on. Narrowing the client to an
 * interface lets tests inject an in-memory store, and keeps the real datastore the
 * default — `lib/kv.ts` stays the sole importer of `@upstash/redis` (CLAUDE.md §6).
 */
export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<unknown>;
  hset(key: string, value: Record<string, unknown>): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  hkeys(key: string): Promise<string[]>;
}

/**
 * The counter slice of `@upstash/redis`, kept separate from `KVClient` so the brief-store
 * consumers and their fakes don't carry methods they never use. `lib/ratelimit.ts`
 * drives daily counters through this; tests inject an in-memory stand-in.
 */
export interface CounterClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

// The Upstash client, built lazily on first use. `new Redis(...)` throws when the REST
// url/token are absent, so we must not construct at import — that would break the
// unconfigured-KV degradation (ADR-0007). Reached only after `skipDatastore` clears,
// i.e. when `isKVConfigured()` is true and both credentials are present.
let redis: Redis | undefined;
function realClient(): Redis {
  if (!redis) {
    const { url, token } = kvCredentials();
    // `!` is sound: realClient runs only past the isKVConfigured short-circuit, so both
    // are set. Were that ever false, the Redis constructor throws a clear error anyway.
    redis = new Redis({ url: url!, token: token! });
  }
  return redis;
}

// The default client delegates each narrowed method to the lazily-built Upstash client,
// so importing this module never constructs Redis. Only the methods these helpers use are
// exposed — `@upstash/redis` provides them with the same JSON (de)serialization as before.
const defaultClient: KVClient = {
  get: <T>(key: string) => realClient().get<T>(key),
  set: (key, value) => realClient().set(key, value),
  hset: (key, value) => realClient().hset(key, value),
  hgetall: (key) => realClient().hgetall(key),
  hkeys: (key) => realClient().hkeys(key),
};

const defaultCounterClient: CounterClient = {
  incr: (key) => realClient().incr(key),
  expire: (key, seconds) => realClient().expire(key, seconds),
};

/**
 * Whether a helper should skip the datastore entirely: the real `@upstash/redis` client is
 * in use but KV is unconfigured (issue #49, ADR-0007). KV is optional — when it is absent
 * reads return empty and writes are dropped, so the brief store falls back to its static
 * seed catalog and generation still works (ephemerally) instead of the product failing to
 * load. Always `false` for an injected client: tests drive their own fake and must reach it
 * regardless of the ambient environment.
 */
function skipDatastore(client: object): boolean {
  if (client !== defaultClient && client !== defaultCounterClient) return false;
  return !isKVConfigured();
}

/** Read a JSON value by key. Returns `null` when the key is absent — or KV is unconfigured. */
export async function get<T>(key: string, client: KVClient = defaultClient): Promise<T | null> {
  if (skipDatastore(client)) return null;
  return client.get<T>(key);
}

/** Write a JSON value by key, overwriting any existing value. A no-op when KV is unconfigured. */
export async function set(
  key: string,
  value: unknown,
  client: KVClient = defaultClient
): Promise<void> {
  if (skipDatastore(client)) return;
  await client.set(key, value);
}

/**
 * Upsert a slug's gallery projection into the `briefs:gallery` hash (ADR-0005).
 * Idempotent — re-writing a slug overwrites its field rather than duplicating it.
 * A no-op when KV is unconfigured.
 */
export async function addToIndex(
  slug: string,
  entry: unknown,
  client: KVClient = defaultClient
): Promise<void> {
  if (skipDatastore(client)) return;
  await client.hset(keys.gallery, { [slug]: entry });
}

/**
 * Read the whole gallery index as a slug → entry map in one call — the O(1) read
 * that lets `listBriefs` skip per-slug full-brief fetches. Empty when the index is unset
 * or KV is unconfigured.
 */
export async function listIndex<T>(client: KVClient = defaultClient): Promise<Record<string, T>> {
  if (skipDatastore(client)) return {};
  return ((await client.hgetall(keys.gallery)) as Record<string, T> | null) ?? {};
}

/** List every slug present in the gallery index. Order is unspecified. Empty when KV is unconfigured. */
export async function indexSlugs(client: KVClient = defaultClient): Promise<string[]> {
  if (skipDatastore(client)) return [];
  return client.hkeys(keys.gallery);
}

/**
 * Atomically increment a counter, returning its new value. Creates it at 1 if absent.
 * Returns `0` when KV is unconfigured — with no durable counter the daily rate limits
 * cannot be enforced, so callers treat every request as under-limit (ADR-0007).
 */
export async function incr(
  key: string,
  client: CounterClient = defaultCounterClient
): Promise<number> {
  if (skipDatastore(client)) return 0;
  return client.incr(key);
}

/** Set a key's time-to-live in seconds, so a counter's window self-expires. A no-op when KV is unconfigured. */
export async function expire(
  key: string,
  seconds: number,
  client: CounterClient = defaultCounterClient
): Promise<void> {
  if (skipDatastore(client)) return;
  await client.expire(key, seconds);
}
