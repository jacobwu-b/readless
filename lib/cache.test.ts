import { test } from "node:test";
import assert from "node:assert";

import { cacheKey, getCachedSlug, setCachedSlug } from "./cache";
import { keys, type KVClient } from "./kv";

/**
 * In-memory stand-in for the slice of `@vercel/kv` the cache uses, mirroring the
 * fakes in `kv.test.ts` / `store.test.ts`. The cache helpers default to the real
 * client; tests inject this so the dedup lookups run with no live connection.
 */
function fakeClient(): KVClient {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
    },
    async set(key: string, value: unknown): Promise<unknown> {
      store.set(key, value);
      return "OK";
    },
    async hset(): Promise<unknown> {
      return 0;
    },
    async hgetall(): Promise<Record<string, unknown> | null> {
      return null;
    },
    async hkeys(): Promise<string[]> {
      return [];
    },
  };
}

test("cacheKey joins normalized title and author with a pipe", () => {
  assert.strictEqual(cacheKey("Atomic Habits", "James Clear"), "atomic habits|james clear");
});

test("cacheKey lowercases so case does not split the cache", () => {
  assert.strictEqual(cacheKey("ATOMIC HABITS", "James CLEAR"), cacheKey("atomic habits", "james clear"));
});

test("cacheKey trims surrounding whitespace", () => {
  assert.strictEqual(cacheKey("  Sapiens  ", "  Yuval Noah Harari  "), "sapiens|yuval noah harari");
});

test("cacheKey collapses internal whitespace runs", () => {
  assert.strictEqual(cacheKey("Atomic   Habits", "James\tClear"), "atomic habits|james clear");
});

test("cacheKey treats a missing author as an empty field", () => {
  assert.strictEqual(cacheKey("Sapiens"), "sapiens|");
});

test("cacheKey treats a blank author the same as a missing one", () => {
  assert.strictEqual(cacheKey("Sapiens", "   "), cacheKey("Sapiens"));
});

test("getCachedSlug returns the slug previously written by setCachedSlug", async () => {
  const client = fakeClient();

  await setCachedSlug("Atomic Habits", "James Clear", "atomic-habits", client);
  const slug = await getCachedSlug("Atomic Habits", "James Clear", client);

  assert.strictEqual(slug, "atomic-habits");
});

test("getCachedSlug normalizes the lookup so a differently-cased repeat hits", async () => {
  const client = fakeClient();

  await setCachedSlug("Atomic Habits", "James Clear", "atomic-habits", client);
  const slug = await getCachedSlug("  atomic   habits ", "JAMES CLEAR", client);

  assert.strictEqual(slug, "atomic-habits");
});

test("getCachedSlug returns null when the request was never cached", async () => {
  const client = fakeClient();

  const slug = await getCachedSlug("Deep Work", "Cal Newport", client);

  assert.strictEqual(slug, null);
});

test("setCachedSlug writes under the cache: keyspace owned by lib/kv", async () => {
  const client = fakeClient();

  await setCachedSlug("Sapiens", undefined, "sapiens", client);
  const slug = await client.get<string>(keys.cache(cacheKey("Sapiens")));

  assert.strictEqual(slug, "sapiens");
});
