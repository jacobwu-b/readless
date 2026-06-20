import { test } from "node:test";
import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  keys,
  get,
  set,
  addToIndex,
  listIndex,
  indexSlugs,
  legacyIndexSlugs,
  type KVClient,
} from "./kv";

/**
 * An in-memory stand-in for the slice of `@vercel/kv` these helpers use. Lets the
 * round-trip and index tests run with no live KV connection — the helpers default
 * to the real client, tests inject this. The internal maps are exposed so a test
 * can seed legacy state (the retired `briefs:index` set) the migration reads.
 */
function fakeClient(): KVClient & {
  store: Map<string, unknown>;
  hashes: Map<string, Map<string, unknown>>;
  sets: Map<string, Set<string>>;
} {
  const store = new Map<string, unknown>();
  const hashes = new Map<string, Map<string, unknown>>();
  const sets = new Map<string, Set<string>>();
  return {
    store,
    hashes,
    sets,
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set(key: string, value: unknown): Promise<unknown> {
      store.set(key, value);
      return "OK";
    },
    async hset(key: string, value: Record<string, unknown>): Promise<unknown> {
      const hash = hashes.get(key) ?? new Map<string, unknown>();
      for (const [field, v] of Object.entries(value)) hash.set(field, v);
      hashes.set(key, hash);
      return Object.keys(value).length;
    },
    async hgetall(key: string): Promise<Record<string, unknown> | null> {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : null;
    },
    async hkeys(key: string): Promise<string[]> {
      return [...(hashes.get(key)?.keys() ?? [])];
    },
    async smembers(key: string): Promise<string[]> {
      return [...(sets.get(key) ?? new Set<string>())];
    },
  };
}

test("keys builds the keyspace owned by lib/kv (ADR-0002, ADR-0005)", () => {
  assert.strictEqual(keys.brief("atomic-habits"), "brief:atomic-habits");
  assert.strictEqual(keys.gallery, "briefs:gallery");
  assert.strictEqual(keys.index, "briefs:index");
  assert.strictEqual(keys.cache("atomic habits|james clear"), "cache:atomic habits|james clear");
});

test("get returns the value previously written by set (round-trip)", async () => {
  const client = fakeClient();
  const brief = { slug: "atomic-habits", title: "Atomic Habits", author: "James Clear" };

  await set(keys.brief("atomic-habits"), brief, client);
  const result = await get<typeof brief>(keys.brief("atomic-habits"), client);

  assert.deepStrictEqual(result, brief);
});

test("get returns null for a key that was never set", async () => {
  const client = fakeClient();

  const result = await get(keys.brief("does-not-exist"), client);

  assert.strictEqual(result, null);
});

test("addToIndex stores a slug's projection that listIndex reads back", async () => {
  const client = fakeClient();
  const entry = { slug: "deep-work", title: "Deep Work" };

  await addToIndex("deep-work", entry, client);

  assert.deepStrictEqual(await listIndex<typeof entry>(client), { "deep-work": entry });
});

test("indexSlugs lists every slug projected into the gallery index", async () => {
  const client = fakeClient();

  await addToIndex("atomic-habits", { slug: "atomic-habits" }, client);
  await addToIndex("deep-work", { slug: "deep-work" }, client);
  await addToIndex("thinking-fast-and-slow", { slug: "thinking-fast-and-slow" }, client);

  assert.deepStrictEqual(
    (await indexSlugs(client)).sort(),
    ["atomic-habits", "deep-work", "thinking-fast-and-slow"]
  );
});

test("addToIndex overwrites a slug's projection rather than duplicating it", async () => {
  const client = fakeClient();

  await addToIndex("atomic-habits", { slug: "atomic-habits", title: "Stale" }, client);
  await addToIndex("atomic-habits", { slug: "atomic-habits", title: "Fresh" }, client);

  assert.deepStrictEqual(await indexSlugs(client), ["atomic-habits"]);
  assert.deepStrictEqual(await listIndex(client), {
    "atomic-habits": { slug: "atomic-habits", title: "Fresh" },
  });
});

test("listIndex returns an empty map when the gallery index is unset", async () => {
  const client = fakeClient();

  assert.deepStrictEqual(await listIndex(client), {});
});

test("indexSlugs returns an empty array when the gallery index is unset", async () => {
  const client = fakeClient();

  assert.deepStrictEqual(await indexSlugs(client), []);
});

test("legacyIndexSlugs reads the retired briefs:index set for the migration", async () => {
  const client = fakeClient();
  client.sets.set(keys.index, new Set(["atomic-habits", "deep-work"]));

  assert.deepStrictEqual((await legacyIndexSlugs(client)).sort(), ["atomic-habits", "deep-work"]);
});

test("a helper using the real client fails fast with a clear error when KV is unconfigured", async () => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  try {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    // No injected client → the real-client path runs validateKVConfig before touching
    // @vercel/kv, so misconfiguration surfaces as a clear message, not an opaque SDK
    // failure. Regression guard for issue #26.
    await assert.rejects(() => get(keys.brief("atomic-habits")), /Missing Vercel KV configuration/);
  } finally {
    if (url !== undefined) process.env.KV_REST_API_URL = url;
    if (token !== undefined) process.env.KV_REST_API_TOKEN = token;
  }
});

/**
 * Guard for the CLAUDE.md §6 invariant: `lib/kv.ts` is the sole importer of
 * `@vercel/kv`. No `api/` handler may reach the datastore directly.
 */
test("no api/ handler imports @vercel/kv directly", () => {
  const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "api");

  function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return tsFiles(full);
      return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
    });
  }

  const offenders = tsFiles(apiDir).filter((file) =>
    /["']@vercel\/kv["']/.test(readFileSync(file, "utf8"))
  );

  assert.deepStrictEqual(
    offenders,
    [],
    `api/ handlers must reach KV through lib/kv.ts, not @vercel/kv directly: ${offenders.join(", ")}`
  );
});
