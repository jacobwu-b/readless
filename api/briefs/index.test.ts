import { test } from "node:test";
import assert from "node:assert";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../../lib/kv";
import { saveBrief } from "../../lib/store";
import type { Brief } from "../../lib/schema";

import handler from "./index";

/**
 * In-memory stand-in for the slice of `@vercel/kv` the store uses, mirroring the
 * fakes in `lib/store.test.ts`. Lets the handler's read path run with no live
 * connection — the handler defaults to the real client, tests inject this.
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

/** Records what the handler wrote, so assertions can read status/body/headers back. */
function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res;
}

function req(method: string): VercelRequest {
  return { method } as unknown as VercelRequest;
}

test("GET /api/briefs returns the index entry list of stored briefs", async () => {
  const client = fakeClient();
  await saveBrief(makeBrief({ slug: "deep-work", title: "Deep Work" }), client);
  await saveBrief(makeBrief({ slug: "sapiens", title: "Sapiens" }), client);
  const res = fakeRes();

  await handler(req("GET"), res as unknown as VercelResponse, client, []);

  assert.strictEqual(res.statusCode, 200);
  const body = res.body as Array<{ slug: string }>;
  assert.deepStrictEqual(
    body.map((e) => e.slug).sort(),
    ["deep-work", "sapiens"]
  );
});

test("GET /api/briefs returns lightweight entries without editorial sections", async () => {
  const client = fakeClient();
  await saveBrief(makeBrief(), client);
  const res = fakeRes();

  await handler(req("GET"), res as unknown as VercelResponse, client, []);

  const [entry] = res.body as Array<Record<string, unknown>>;
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

test("GET /api/briefs returns an empty list when no briefs are stored", async () => {
  const res = fakeRes();

  await handler(req("GET"), res as unknown as VercelResponse, fakeClient(), []);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, []);
});

test("GET /api/briefs returns 405 for a non-GET method", async () => {
  const res = fakeRes();

  await handler(req("POST"), res as unknown as VercelResponse, fakeClient());

  assert.strictEqual(res.statusCode, 405);
  assert.strictEqual(res.headers["Allow"], "GET");
});
