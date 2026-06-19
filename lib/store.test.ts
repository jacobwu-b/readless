import { test } from "node:test";
import assert from "node:assert";

import { saveBrief, getBrief, listBriefs } from "./store";
import { keys, type KVClient } from "./kv";
import type { Brief } from "./schema";

/**
 * In-memory stand-in for the slice of `@vercel/kv` the store uses, mirroring the
 * fake in `kv.test.ts`. Lets the store's KV interactions run with no live
 * connection — the store defaults to the real client, tests inject this.
 */
function fakeClient(): KVClient {
  const store = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return store.has(key) ? (store.get(key) as T) : null;
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

/** A minimal schema-valid Brief; `overrides` vary the fields a test cares about. */
function makeBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    year: 2018,
    category: "Self-Development",
    tags: ["habits", "productivity"],
    cover: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    dateAdded: "2026-03-08",
    readTime: "9 min",
    thesis: "You fall to the level of your systems, not your goals.",
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
    ...overrides,
  };
}

test("saveBrief then getBrief round-trips a brief through KV", async () => {
  const client = fakeClient();
  const brief = makeBrief();

  await saveBrief(brief, client);
  const result = await getBrief(brief.slug, client, []);

  assert.deepStrictEqual(result, brief);
});

test("saveBrief registers the slug so listBriefs surfaces it", async () => {
  const client = fakeClient();
  const brief = makeBrief({ slug: "deep-work", title: "Deep Work" });

  await saveBrief(brief, client);
  const entries = await listBriefs(client, []);

  assert.deepStrictEqual(
    entries.map((e) => e.slug),
    ["deep-work"]
  );
});

test("getBrief falls back to a static seed when KV has no entry", async () => {
  const client = fakeClient();
  const seed = makeBrief({ slug: "sapiens", title: "Sapiens", author: "Yuval Noah Harari" });

  const result = await getBrief("sapiens", client, [seed]);

  assert.deepStrictEqual(result, seed);
});

test("getBrief returns null for an unknown slug", async () => {
  const client = fakeClient();

  const result = await getBrief("does-not-exist", client, [makeBrief({ slug: "sapiens" })]);

  assert.strictEqual(result, null);
});

test("getBrief prefers the KV brief over a seed with the same slug", async () => {
  const client = fakeClient();
  const seed = makeBrief({ slug: "atomic-habits", readTime: "stale" });
  const fresh = makeBrief({ slug: "atomic-habits", readTime: "9 min" });

  await saveBrief(fresh, client);
  const result = await getBrief("atomic-habits", client, [seed]);

  assert.strictEqual(result?.readTime, "9 min");
});

test("listBriefs merges KV briefs with static seeds", async () => {
  const client = fakeClient();
  await saveBrief(makeBrief({ slug: "deep-work", title: "Deep Work" }), client);
  const seed = makeBrief({ slug: "sapiens", title: "Sapiens" });

  const entries = await listBriefs(client, [seed]);

  assert.deepStrictEqual(entries.map((e) => e.slug).sort(), ["deep-work", "sapiens"]);
});

test("listBriefs lets a KV brief win over a seed with the same slug", async () => {
  const client = fakeClient();
  const seed = makeBrief({ slug: "atomic-habits", title: "Stale Title" });
  await saveBrief(makeBrief({ slug: "atomic-habits", title: "Fresh Title" }), client);

  const entries = await listBriefs(client, [seed]);

  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0]?.title, "Fresh Title");
});

test("listBriefs returns lightweight index entries without editorial sections", async () => {
  const client = fakeClient();
  await saveBrief(makeBrief(), client);

  const [entry] = await listBriefs(client, []);

  assert.deepStrictEqual(Object.keys(entry ?? {}).sort(), [
    "author",
    "category",
    "cover",
    "dateAdded",
    "readTime",
    "slug",
    "tags",
    "title",
    "year",
  ]);
});
