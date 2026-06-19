import { test } from "node:test";
import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { keys, get, set, addToIndex, list, type KVClient } from "./kv";

/**
 * An in-memory stand-in for the slice of `@vercel/kv` these helpers use. Lets the
 * round-trip and index tests run with no live KV connection — the helpers default
 * to the real client, tests inject this.
 */
function fakeClient(): KVClient & { store: Map<string, unknown>; sets: Map<string, Set<string>> } {
  const store = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  return {
    store,
    sets,
    async get<T>(key: string): Promise<T | null> {
      return (store.has(key) ? (store.get(key) as T) : null);
    },
    async set(key: string, value: unknown): Promise<unknown> {
      store.set(key, value);
      return "OK";
    },
    async sadd(key: string, ...members: string[]): Promise<unknown> {
      const existing = sets.get(key) ?? new Set<string>();
      members.forEach((m) => existing.add(m));
      sets.set(key, existing);
      return members.length;
    },
    async smembers(key: string): Promise<string[]> {
      return [...(sets.get(key) ?? new Set<string>())];
    },
  };
}

test("keys builds the keyspace owned by lib/kv (ADR-0002)", () => {
  assert.strictEqual(keys.brief("atomic-habits"), "brief:atomic-habits");
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

test("list returns all members added to the index", async () => {
  const client = fakeClient();

  await addToIndex("atomic-habits", client);
  await addToIndex("deep-work", client);
  await addToIndex("thinking-fast-and-slow", client);

  const members = await list(client);

  assert.deepStrictEqual(
    [...members].sort(),
    ["atomic-habits", "deep-work", "thinking-fast-and-slow"]
  );
});

test("addToIndex is idempotent — re-adding a slug does not duplicate it", async () => {
  const client = fakeClient();

  await addToIndex("atomic-habits", client);
  await addToIndex("atomic-habits", client);

  assert.deepStrictEqual(await list(client), ["atomic-habits"]);
});

test("list returns an empty array when the index has no members", async () => {
  const client = fakeClient();

  assert.deepStrictEqual(await list(client), []);
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
