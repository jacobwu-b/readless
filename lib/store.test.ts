import { test } from "node:test";
import assert from "node:assert";

import { saveBrief, createBrief, getBrief, listBriefs, backfillGalleryIndex } from "./store";
import { keys, type KVClient } from "./kv";
import type { Brief } from "./schema";

/** Per-method call counts, so a test can assert listBriefs reads the index O(1). */
interface Calls {
  get: number;
  hgetall: number;
}

/**
 * In-memory stand-in for the slice of `@vercel/kv` the store uses, mirroring the
 * fake in `kv.test.ts`. Lets the store's KV interactions run with no live
 * connection — the store defaults to the real client, tests inject this. The
 * internal maps and `calls` counters are exposed so tests can seed legacy state
 * (the retired `briefs:index` set) and assert the gallery read is O(1).
 */
function fakeClient(): KVClient & {
  store: Map<string, unknown>;
  sets: Map<string, Set<string>>;
  calls: Calls;
} {
  const store = new Map<string, unknown>();
  const hashes = new Map<string, Map<string, unknown>>();
  const sets = new Map<string, Set<string>>();
  const calls: Calls = { get: 0, hgetall: 0 };
  return {
    store,
    sets,
    calls,
    async get<T>(key: string): Promise<T | null> {
      calls.get += 1;
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
      calls.hgetall += 1;
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

test("createBrief stores under the base slug and returns it when the slug is free", async () => {
  const client = fakeClient();
  const brief = makeBrief({ slug: "deep-work", title: "Deep Work" });

  const stored = await createBrief(brief, client, []);

  assert.strictEqual(stored.slug, "deep-work");
  assert.deepStrictEqual(await getBrief("deep-work", client, []), brief);
});

test("createBrief derives the slug from the title, ignoring the model-provided slug", async () => {
  const client = fakeClient();
  // A model that tried to seize an arbitrary key must not control where we persist.
  const brief = makeBrief({ slug: "../evil-overwrite", title: "Atomic Habits" });

  const stored = await createBrief(brief, client, []);

  assert.strictEqual(stored.slug, "atomic-habits");
  assert.strictEqual(await getBrief("../evil-overwrite", client, []), null);
});

test("createBrief disambiguates a title that collides with an existing stored brief", async () => {
  const client = fakeClient();
  // Two distinct books share a title ("The Power"): Naomi Alderman's and Robert Greene's.
  const alderman = makeBrief({ slug: "the-power", title: "The Power", author: "Naomi Alderman" });
  await createBrief(alderman, client, []);

  const greene = makeBrief({ slug: "the-power", title: "The Power", author: "Robert Greene" });
  const stored = await createBrief(greene, client, []);

  assert.strictEqual(stored.slug, "the-power-2");
  // The first book is untouched; both are independently addressable.
  assert.strictEqual((await getBrief("the-power", client, []))?.author, "Naomi Alderman");
  assert.strictEqual((await getBrief("the-power-2", client, []))?.author, "Robert Greene");
});

test("createBrief does not overwrite a curated seed sharing the title", async () => {
  const client = fakeClient();
  const seed = makeBrief({ slug: "sapiens", title: "Sapiens", author: "Yuval Noah Harari" });
  const generated = makeBrief({ slug: "sapiens", title: "Sapiens", author: "Impostor" });

  const stored = await createBrief(generated, client, [seed]);

  assert.strictEqual(stored.slug, "sapiens-2");
  // The curated seed still resolves under its own slug.
  assert.strictEqual((await getBrief("sapiens", client, [seed]))?.author, "Yuval Noah Harari");
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

test("listBriefs reads the gallery index once and never fetches full briefs (O(1))", async () => {
  const client = fakeClient();
  // A corpus large enough that an N+1 read pattern would be unmistakable.
  for (let i = 0; i < 25; i += 1) {
    await saveBrief(makeBrief({ slug: `brief-${i}`, title: `Brief ${i}` }), client);
  }
  client.calls.get = 0;
  client.calls.hgetall = 0;

  const entries = await listBriefs(client, []);

  assert.strictEqual(entries.length, 25);
  // One index read, regardless of corpus size — and no per-slug full-brief fetches.
  assert.strictEqual(client.calls.hgetall, 1);
  assert.strictEqual(client.calls.get, 0);
});

test("backfillGalleryIndex projects legacy briefs:index entries into the gallery hash", async () => {
  const client = fakeClient();
  // Simulate the pre-migration world: full briefs stored, slugs only in the retired set.
  const deepWork = makeBrief({ slug: "deep-work", title: "Deep Work" });
  const sapiens = makeBrief({ slug: "sapiens", title: "Sapiens" });
  await client.set(keys.brief("deep-work"), deepWork);
  await client.set(keys.brief("sapiens"), sapiens);
  client.sets.set(keys.index, new Set(["deep-work", "sapiens"]));

  const count = await backfillGalleryIndex(client);

  assert.strictEqual(count, 2);
  // The gallery now lists both without any legacy set involvement.
  const entries = await listBriefs(client, []);
  assert.deepStrictEqual(entries.map((e) => e.slug).sort(), ["deep-work", "sapiens"]);
  assert.deepStrictEqual(Object.keys(entries[0] ?? {}).sort(), [
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

test("backfillGalleryIndex skips a legacy slug whose full brief is missing", async () => {
  const client = fakeClient();
  await client.set(keys.brief("deep-work"), makeBrief({ slug: "deep-work", title: "Deep Work" }));
  // "ghost" is in the set but its brief:{slug} was never written (or was evicted).
  client.sets.set(keys.index, new Set(["deep-work", "ghost"]));

  const count = await backfillGalleryIndex(client);

  assert.strictEqual(count, 1);
  assert.deepStrictEqual((await listBriefs(client, [])).map((e) => e.slug), ["deep-work"]);
});
