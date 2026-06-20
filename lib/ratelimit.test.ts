import { test } from "node:test";
import assert from "node:assert";

import type { CounterClient } from "./kv";
import { keys } from "./kv";
import { clientIp, enforceRateLimit } from "./ratelimit";

/**
 * In-memory stand-in for the counter slice of `@vercel/kv`, mirroring the fakes in
 * `kv.test.ts` / `cache.test.ts`. It exposes the `counts` and `ttls` maps so tests can
 * assert which keys were incremented and that a TTL was set, with no live connection.
 */
function fakeCounters(): { client: CounterClient; counts: Map<string, number>; ttls: Map<string, number> } {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  const client: CounterClient = {
    async incr(key: string): Promise<number> {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async expire(key: string, seconds: number): Promise<unknown> {
      ttls.set(key, seconds);
      return 1;
    },
  };
  return { client, counts, ttls };
}

// A fixed instant so day-keying and Retry-After are deterministic (mid-day UTC).
const NOON = new Date("2026-06-19T12:00:00.000Z");

test("enforceRateLimit allows a request under the per-IP limit", async () => {
  const { client } = fakeCounters();

  const result = await enforceRateLimit("203.0.113.7", {
    client,
    now: NOON,
    ipPerDay: 20,
    globalPerDay: 100,
  });

  assert.strictEqual(result.allowed, true);
});

test("enforceRateLimit blocks a request over the per-IP limit with a Retry-After", async () => {
  const { client } = fakeCounters();
  const opts = { client, now: NOON, ipPerDay: 3, globalPerDay: 100 };

  for (let i = 0; i < 3; i++) {
    const ok = await enforceRateLimit("203.0.113.7", opts);
    assert.strictEqual(ok.allowed, true, `request ${i + 1} should be under the limit`);
  }

  const blocked = await enforceRateLimit("203.0.113.7", opts);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reason, "per-ip");
  assert.ok(
    typeof blocked.retryAfter === "number" && blocked.retryAfter > 0,
    "a blocked response carries a positive Retry-After"
  );
});

test("enforceRateLimit hard-blocks once the global daily cap is reached", async () => {
  const { client } = fakeCounters();
  // Distinct IPs so the per-IP limit never trips — only the global cap can block here.
  const opts = { client, now: NOON, ipPerDay: 100, globalPerDay: 2 };

  assert.strictEqual((await enforceRateLimit("198.51.100.1", opts)).allowed, true);
  assert.strictEqual((await enforceRateLimit("198.51.100.2", opts)).allowed, true);

  const blocked = await enforceRateLimit("198.51.100.3", opts);
  assert.strictEqual(blocked.allowed, false, "generation is blocked once the global cap is reached");
  assert.strictEqual(blocked.reason, "global");
  assert.ok(typeof blocked.retryAfter === "number" && blocked.retryAfter > 0);
});

test("enforceRateLimit keys counters per IP and per UTC day", async () => {
  const { client, counts } = fakeCounters();

  await enforceRateLimit("203.0.113.7", { client, now: NOON, ipPerDay: 20, globalPerDay: 100 });

  assert.ok(counts.has(keys.rlIp("203.0.113.7", "2026-06-19")), "per-IP counter is keyed by ip and day");
  assert.ok(counts.has(keys.rlGlobal("2026-06-19")), "global counter is keyed by day");
});

test("enforceRateLimit expires the counter so the daily window resets", async () => {
  const { client, ttls } = fakeCounters();

  await enforceRateLimit("203.0.113.7", { client, now: NOON, ipPerDay: 20, globalPerDay: 100 });

  const ipTtl = ttls.get(keys.rlIp("203.0.113.7", "2026-06-19"));
  assert.ok(ipTtl !== undefined && ipTtl > 0, "a TTL is set when the window opens");
  // NOON is 12:00:00Z, so the window expires in the 12 hours remaining in the UTC day.
  assert.strictEqual(ipTtl, 12 * 60 * 60);
});

test("enforceRateLimit re-arms the TTL on every hit so an incr without expire cannot leak a TTL-less key", async () => {
  // A crash between incr and a first-hit-only expire would leave a counter with no
  // TTL, leaking a stale date-stamped key (issue #22(c)). Arming the TTL on every
  // hit closes that race; it is idempotent since the key always expires at the same
  // UTC midnight regardless of which hit set it.
  const { client, ttls } = fakeCounters();
  const opts = { client, now: NOON, ipPerDay: 20, globalPerDay: 100 };
  const ipKey = keys.rlIp("203.0.113.7", "2026-06-19");

  await enforceRateLimit("203.0.113.7", opts);
  ttls.delete(ipKey); // prove the *next* hit re-arms it, not just the first

  await enforceRateLimit("203.0.113.7", opts);

  assert.strictEqual(ttls.get(ipKey), 12 * 60 * 60, "every hit re-arms the TTL to the seconds left in the UTC day");
});

test("enforceRateLimit isolates counters across days so a new day resets the limit", async () => {
  const { client } = fakeCounters();
  const day1 = { client, now: NOON, ipPerDay: 1, globalPerDay: 100 };
  const day2 = { client, now: new Date("2026-06-20T12:00:00.000Z"), ipPerDay: 1, globalPerDay: 100 };

  assert.strictEqual((await enforceRateLimit("203.0.113.7", day1)).allowed, true);
  assert.strictEqual((await enforceRateLimit("203.0.113.7", day1)).allowed, false, "second hit same day is blocked");

  assert.strictEqual(
    (await enforceRateLimit("203.0.113.7", day2)).allowed,
    true,
    "the same IP is allowed again on the next day"
  );
});

test("clientIp takes the first hop of a comma-separated X-Forwarded-For", () => {
  const req = { headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" } };

  assert.strictEqual(clientIp(req), "203.0.113.7");
});

test("clientIp falls back to X-Real-IP when forwarded-for is absent", () => {
  const req = { headers: { "x-real-ip": "198.51.100.23" } };

  assert.strictEqual(clientIp(req), "198.51.100.23");
});

test("clientIp returns a stable placeholder when no IP header is present", () => {
  assert.strictEqual(clientIp({ headers: {} }), "unknown");
});
