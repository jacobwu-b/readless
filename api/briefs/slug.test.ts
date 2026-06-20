import { test } from "node:test";
import assert from "node:assert";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../../lib/kv";
import { saveBrief } from "../../lib/store";
import type { Brief } from "../../lib/schema";

import handler from "./[slug]";

/**
 * In-memory stand-in for the slice of `@vercel/kv` the store uses, mirroring the
 * fakes in `lib/store.test.ts`. Lets the handler's read path run with no live
 * connection — the handler defaults to the real client, tests inject this.
 */
function fakeClient(): KVClient {
  const store = new Map<string, unknown>();
  const hashes = new Map<string, Map<string, unknown>>();
  return {
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
    async smembers(): Promise<string[]> {
      return [];
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

function req(method: string, slug?: string | string[]): VercelRequest {
  return { method, query: { slug } } as unknown as VercelRequest;
}

test("GET /api/briefs/[slug] returns the full brief when it exists", async () => {
  const client = fakeClient();
  const brief = makeBrief({ slug: "deep-work", title: "Deep Work" });
  await saveBrief(brief, client);
  const res = fakeRes();

  await handler(req("GET", "deep-work"), res as unknown as VercelResponse, client);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, brief);
});

test("GET /api/briefs/[slug] returns 404 when the brief does not exist", async () => {
  const res = fakeRes();

  await handler(req("GET", "does-not-exist"), res as unknown as VercelResponse, fakeClient());

  assert.strictEqual(res.statusCode, 404);
});

test("GET /api/briefs/[slug] returns 404 for a missing slug param", async () => {
  const res = fakeRes();

  await handler(req("GET", undefined), res as unknown as VercelResponse, fakeClient());

  assert.strictEqual(res.statusCode, 404);
});

test("GET /api/briefs/[slug] returns 405 for a non-GET method", async () => {
  const res = fakeRes();

  await handler(req("POST", "deep-work"), res as unknown as VercelResponse, fakeClient());

  assert.strictEqual(res.statusCode, 405);
  assert.strictEqual(res.headers["Allow"], "GET");
});
