import { test } from "node:test";
import assert from "node:assert";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../lib/kv";

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
  return { method, body } as unknown as VercelRequest;
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
    fakeClient()
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
    client
  );

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, brief);
  // The brief is addressable by its slug, and the request is cached to that slug.
  assert.deepStrictEqual(await client.get(keys.brief(brief.slug)), brief);
  assert.strictEqual(await client.get(keys.cache(cacheKey("Atomic Habits", "James Clear"))), brief.slug);
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
    client
  );

  // A repeat with different casing/spacing must hit the cache, not the model.
  const res = fakeRes();
  await handler(
    req("POST", { title: "  ATOMIC   HABITS ", author: "james clear" }),
    res as unknown as VercelResponse,
    generate,
    client
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
    client
  );

  assert.strictEqual(calls, 1, "a dangling cache entry must fall through to generation");
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(await client.get(keys.brief(brief.slug)), brief);
});
