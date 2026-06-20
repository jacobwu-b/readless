import { test } from "node:test";
import assert from "node:assert";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { CounterClient, KVClient } from "../lib/kv";

// handler -> ../lib/generate -> anthropic.ts -> env.ts reads ANTHROPIC_API_KEY at
// import time. Set it, then import dynamically so the assignment runs before the
// module graph loads (static imports are hoisted above it).
process.env.ANTHROPIC_API_KEY ||= "test-key";
const { default: handler } = await import("./generate");
const { BriefGenerationError } = await import("../lib/generate");
const { keys } = await import("../lib/kv");
const { cacheKey } = await import("../lib/cache");

/** A minimal well-formed brief; the handler treats it as an opaque pass-through. */
function validBrief() {
  return { slug: "atomic-habits", title: "Atomic Habits", author: "James Clear" };
}

/**
 * In-memory stand-in for the slice of `@vercel/kv` the store and cache use, so the
 * handler's persistence + dedup paths run with no live connection. Mirrors the fakes
 * in `lib/kv.test.ts`; the handler defaults to the real client, tests inject this.
 */
function fakeClient(): KVClient & CounterClient {
  const store = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  const counters = new Map<string, number>();
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
    async incr(key: string): Promise<number> {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    },
    async expire(): Promise<unknown> {
      return 1;
    },
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

function req(method: string, body: unknown): VercelRequest {
  return { method, body, headers: { "x-forwarded-for": "203.0.113.7" } } as unknown as VercelRequest;
}

test("POST /api/generate returns 200 with a Brief for a valid body", async () => {
  const brief = validBrief();
  const generate = async (title: string, author?: string) => {
    assert.strictEqual(title, "Atomic Habits");
    assert.strictEqual(author, "James Clear");
    return brief as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits", author: "James Clear" }),
    res as unknown as VercelResponse,
    generate,
    fakeClient(),
    [] // isolate from the committed seeds, which already include "atomic-habits"
  );

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, brief);
});

test("POST /api/generate accepts a body with no author", async () => {
  const generate = async (title: string, author?: string) => {
    assert.strictEqual(title, "Sapiens");
    assert.strictEqual(author, undefined);
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Sapiens" }),
    res as unknown as VercelResponse,
    generate,
    fakeClient()
  );

  assert.strictEqual(res.statusCode, 200);
});

test("POST /api/generate parses a string body and returns 200", async () => {
  // Vercel normally parses JSON bodies, but a raw string can arrive; handle it.
  const generate = async () => validBrief() as never;
  const res = fakeRes();

  await handler(
    req("POST", JSON.stringify({ title: "Atomic Habits" })),
    res as unknown as VercelResponse,
    generate,
    fakeClient()
  );

  assert.strictEqual(res.statusCode, 200);
});

test("POST /api/generate returns 400 for a missing title", async () => {
  let called = false;
  const generate = async () => {
    called = true;
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(req("POST", { author: "James Clear" }), res as unknown as VercelResponse, generate);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(called, false, "generation should not run for an invalid body");
});

test("POST /api/generate returns 400 for a blank title", async () => {
  const generate = async () => validBrief() as never;
  const res = fakeRes();

  await handler(req("POST", { title: "   " }), res as unknown as VercelResponse, generate);

  assert.strictEqual(res.statusCode, 400);
});

test("POST /api/generate returns 400 for a non-string title", async () => {
  const generate = async () => validBrief() as never;
  const res = fakeRes();

  await handler(req("POST", { title: 42 }), res as unknown as VercelResponse, generate);

  assert.strictEqual(res.statusCode, 400);
});

test("POST /api/generate returns 400 for a title longer than the bound", async () => {
  let called = false;
  const generate = async () => {
    called = true;
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "x".repeat(201) }),
    res as unknown as VercelResponse,
    generate
  );

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(called, false, "an over-long title must not reach the model");
});

test("POST /api/generate returns 400 for an author longer than the bound", async () => {
  const generate = async () => validBrief() as never;
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits", author: "A".repeat(121) }),
    res as unknown as VercelResponse,
    generate
  );

  assert.strictEqual(res.statusCode, 400);
});

test("POST /api/generate returns 400 for control characters in the title", async () => {
  const generate = async () => validBrief() as never;
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic" + String.fromCharCode(0) + "Habits" }),
    res as unknown as VercelResponse,
    generate
  );

  assert.strictEqual(res.statusCode, 400);
});

test("POST /api/generate returns 413 for an oversized body without calling the model", async () => {
  let called = false;
  const generate = async () => {
    called = true;
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits", junk: "x".repeat(4096) }),
    res as unknown as VercelResponse,
    generate
  );

  assert.strictEqual(res.statusCode, 413);
  assert.strictEqual(called, false, "an oversized body must not reach the model");
});

test("POST /api/generate returns 405 for a non-POST method", async () => {
  let called = false;
  const generate = async () => {
    called = true;
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(req("GET", undefined), res as unknown as VercelResponse, generate);

  assert.strictEqual(res.statusCode, 405);
  assert.strictEqual(res.headers["Allow"], "POST");
  assert.strictEqual(called, false, "generation should not run for a non-POST method");
});

test("POST /api/generate returns 502 when generation fails", async () => {
  const generate = async () => {
    throw new BriefGenerationError("invalid_json", "The model returned invalid JSON");
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits" }),
    res as unknown as VercelResponse,
    generate,
    fakeClient()
  );

  assert.strictEqual(res.statusCode, 502);
});

test("POST /api/generate returns 502 when generation throws an unexpected error", async () => {
  const generate = async () => {
    throw new Error("network exploded");
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits" }),
    res as unknown as VercelResponse,
    generate,
    fakeClient()
  );

  assert.strictEqual(res.statusCode, 502);
});

test("POST /api/generate persists the generated brief and returns its slug", async () => {
  const brief = validBrief();
  const generate = async () => brief as never;
  const client = fakeClient();
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits", author: "James Clear" }),
    res as unknown as VercelResponse,
    generate,
    client,
    [] // isolate from the committed seeds, which already include "atomic-habits"
  );

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, brief);
  // The brief is addressable by its slug, and the request is cached to that slug.
  assert.deepStrictEqual(await client.get(keys.brief(brief.slug)), brief);
  assert.strictEqual(await client.get(keys.cache(cacheKey("Atomic Habits", "James Clear"))), brief.slug);
});

test("POST /api/generate gives two same-title books distinct slugs without overwriting", async () => {
  // Two distinct books share a title ("The Power"); the model returns the same slug
  // for both. The server must disambiguate so the first is not clobbered.
  const alderman = { slug: "the-power", title: "The Power", author: "Naomi Alderman" };
  const greene = { slug: "the-power", title: "The Power", author: "Robert Greene" };
  const generate = async (_title: string, author?: string) =>
    (author === "Robert Greene" ? greene : alderman) as never;
  const client = fakeClient();

  await handler(
    req("POST", { title: "The Power", author: "Naomi Alderman" }),
    fakeRes() as unknown as VercelResponse,
    generate,
    client,
    []
  );
  const res = fakeRes();
  await handler(
    req("POST", { title: "The Power", author: "Robert Greene" }),
    res as unknown as VercelResponse,
    generate,
    client,
    []
  );

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual((res.body as { slug: string }).slug, "the-power-2");
  // Both books are independently addressable; the first was not overwritten.
  assert.deepStrictEqual(await client.get(keys.brief("the-power")), alderman);
  assert.deepStrictEqual(await client.get(keys.brief("the-power-2")), {
    ...greene,
    slug: "the-power-2",
  });
});

test("POST /api/generate returns the cached brief on a repeat without calling the model", async () => {
  const brief = validBrief();
  let calls = 0;
  const generate = async () => {
    calls += 1;
    return brief as never;
  };
  const client = fakeClient();

  // First request generates and persists.
  await handler(
    req("POST", { title: "Atomic Habits", author: "James Clear" }),
    fakeRes() as unknown as VercelResponse,
    generate,
    client,
    [] // isolate from the committed seeds, which already include "atomic-habits"
  );

  // A repeat with different casing/spacing must hit the cache, not the model.
  const res = fakeRes();
  await handler(
    req("POST", { title: "  ATOMIC   HABITS ", author: "james clear" }),
    res as unknown as VercelResponse,
    generate,
    client,
    []
  );

  assert.strictEqual(calls, 1, "the model should run only for the first request");
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, brief);
});

test("POST /api/generate regenerates when a cached slug no longer resolves to a brief", async () => {
  const brief = validBrief();
  let calls = 0;
  const generate = async () => {
    calls += 1;
    return brief as never;
  };
  const client = fakeClient();
  // Cache points at a slug whose brief was never stored (a dangling entry).
  await client.set(keys.cache(cacheKey("Atomic Habits", "James Clear")), "atomic-habits");

  const res = fakeRes();
  await handler(
    req("POST", { title: "Atomic Habits", author: "James Clear" }),
    res as unknown as VercelResponse,
    generate,
    client,
    [] // isolate from the committed seed catalog: the slug must be a true KV miss
  );

  assert.strictEqual(calls, 1, "a dangling cache entry must fall through to generation");
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(await client.get(keys.brief(brief.slug)), brief);
});

test("POST /api/generate serves a cache hit even when the global cap is reached", async () => {
  // The dedup cache must be consulted before the spend cap: a repeat returns a
  // stored brief at zero model cost, so it must not be blocked by — or count
  // against — the global counter. This is the DoS guard from issue #22(a).
  const brief = validBrief();
  const client = fakeClient();
  // Seed a stored brief and its cache entry, as a prior generation would have.
  await client.set(keys.brief(brief.slug), brief);
  await client.set(keys.cache(cacheKey("Atomic Habits", "James Clear")), brief.slug);
  // Drive the global daily counter to its default ceiling.
  const day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 100; i++) {
    await client.incr(keys.rlGlobal(day));
  }

  let called = false;
  const generate = async () => {
    called = true;
    return brief as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits", author: "James Clear" }),
    res as unknown as VercelResponse,
    generate,
    client,
    [] // isolate from the committed seeds, which already include "atomic-habits"
  );

  assert.strictEqual(res.statusCode, 200, "a cache hit is served even at the cap");
  assert.deepStrictEqual(res.body, brief);
  assert.strictEqual(called, false, "a cache hit must not call the model");
  // The cap counter is unchanged by the cache hit: the next incr returns 101, not 102.
  assert.strictEqual(await client.incr(keys.rlGlobal(day)), 101, "a cache hit must not burn a cap slot");
});

test("POST /api/generate returns 429 with Retry-After once the global cap is reached", async () => {
  const client = fakeClient();
  // Pre-fill the global daily counter to its default ceiling so the next request blocks.
  const day = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 100; i++) {
    await client.incr(keys.rlGlobal(day));
  }

  let called = false;
  const generate = async () => {
    called = true;
    return validBrief() as never;
  };
  const res = fakeRes();

  await handler(
    req("POST", { title: "Atomic Habits" }),
    res as unknown as VercelResponse,
    generate,
    client
  );

  assert.strictEqual(res.statusCode, 429);
  assert.ok(res.headers["Retry-After"], "a 429 carries a Retry-After header");
  assert.strictEqual(called, false, "the model must not run once the global cap is reached");
});
