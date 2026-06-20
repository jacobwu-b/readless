import { test } from "node:test";
import assert from "node:assert";

import { migrate } from "./migrate-gallery-index";
import { keys, type KVClient } from "../lib/kv";
import type { Brief } from "../lib/schema";

/**
 * In-memory stand-in for the slice of `@vercel/kv` the backfill touches, mirroring
 * the store fake. The legacy `briefs:index` set is exposed so the test can seed the
 * pre-migration world the one-shot script reads from.
 */
function fakeClient(): KVClient & { sets: Map<string, Set<string>> } {
  const store = new Map<string, unknown>();
  const hashes = new Map<string, Map<string, unknown>>();
  const sets = new Map<string, Set<string>>();
  return {
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

function makeBrief(slug: string, title: string): Brief {
  return {
    slug,
    title,
    author: "James Clear",
    year: 2018,
    category: "Self-Development",
    tags: ["habits"],
    cover: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    dateAdded: "2026-03-08",
    readTime: "9 min",
    thesis: "You fall to the level of your systems.",
    keyInsights: Array.from({ length: 5 }, (_, i) => ({
      title: `Insight ${i + 1}`,
      points: ["A supporting point", "Another supporting point"],
    })),
    pullQuote: "You do not rise to the level of your goals.",
    watchOutFor: Array.from({ length: 3 }, (_, i) => ({
      title: `Watch out ${i + 1}`,
      points: ["A caution worth noting"],
    })),
    applyThis: Array.from({ length: 3 }, (_, i) => ({
      title: `Apply ${i + 1}`,
      points: ["A concrete action"],
    })),
    reflectionQuestions: ["Q1", "Q2", "Q3", "Q4"],
  };
}

test("migrate backfills the gallery hash from the legacy index and reports the count", async () => {
  const client = fakeClient();
  await client.set(keys.brief("deep-work"), makeBrief("deep-work", "Deep Work"));
  await client.set(keys.brief("sapiens"), makeBrief("sapiens", "Sapiens"));
  client.sets.set(keys.index, new Set(["deep-work", "sapiens"]));

  const count = await migrate(client);

  assert.strictEqual(count, 2);
  assert.deepStrictEqual(
    Object.keys((await client.hgetall(keys.gallery)) ?? {}).sort(),
    ["deep-work", "sapiens"]
  );
});
