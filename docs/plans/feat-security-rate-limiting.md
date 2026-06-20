# Plan: feat/security-rate-limiting

> Size: M
> Spec: docs/specs/0005-abuse-controls.md
> Author: @jacobwu-b
> Status: approved

## Branch

`feat/security-rate-limiting`

## What

Enforce a per-IP daily counter and a global daily spend-cap counter on KV (with TTLs),
checked at the top of `POST /api/generate`, so worst-case paid spend is bounded (J-113).

## Files

- `lib/kv.ts` — add `rlIp`/`rlGlobal` keys, a narrow `CounterClient` interface, and `incr`/`expire` helpers (modify).
- `lib/ratelimit.ts` — token-bucket-style fixed-window enforcement + `clientIp` extraction (create).
- `lib/ratelimit.test.ts` — unit tests with mocked KV + clock (create).
- `lib/env.ts` — `RATE_LIMIT_IP_PER_DAY`, `RATE_LIMIT_GLOBAL_PER_DAY` config (modify).
- `api/generate.ts` — wire enforcement; return `429` + `Retry-After` on block (modify).
- `api/generate.test.ts` — wiring test for the 429 path; extend the fake to back counters (modify).
- `.env.example` — document the two new limit vars (modify).

## Approach

- Fixed-window counters keyed per UTC day, exactly as ADR-0003 specifies:
  `rl:ip:{ip}:{yyyy-mm-dd}` and `rl:global:{yyyy-mm-dd}`. `incr` the key; on the first hit
  (count === 1) set TTL to end of the UTC day so the window self-expires.
- `enforceRateLimit(ip, opts)` checks per-IP first, then global; over either limit → blocked with
  `retryAfter` = seconds until end of UTC day and a `reason`. Limits default from `lib/env.ts` but
  are overridable via `opts` for deterministic tests; `now` is injectable for clock control.
- `lib/kv.ts` stays the sole `@vercel/kv` importer: it owns the new keys and exposes `incr`/`expire`
  + a `CounterClient` interface, leaving the existing `KVClient` (and its fakes) untouched.
- In `api/generate.ts`, enforcement runs after the method + title checks and before dedup/model call.
  The injected `client` widens to `KVClient & CounterClient`; the one test fake gains in-memory counters.

## Tests

- `lib/ratelimit.test.ts` (mocked KV + clock): under-limit request allowed; over per-IP → blocked with
  `retryAfter`; global cap hard-blocks even for a fresh IP; counters are date-stamped and `expire` is
  called once at window open; `clientIp` parses `x-forwarded-for` first hop and falls back.
- `api/generate.test.ts`: a request over the global cap returns `429` with a `Retry-After` header.

## Manual steps

- Set `RATE_LIMIT_IP_PER_DAY` (default 20) and `RATE_LIMIT_GLOBAL_PER_DAY` (default 100) in Vercel if
  non-default limits are wanted; defaults apply when unset. Documented in `.env.example`.

---

## Full-plan additions

### Blast radius

- **Schema (KV keyspace):** adds `rl:ip:*` and `rl:global:*` keys under `lib/kv.ts`. Additive; no
  existing key changes. Counters carry a daily TTL and are never read across day boundaries.
- **Public types:** new `CounterClient` interface + `incr`/`expire` exports in `lib/kv.ts`; existing
  `KVClient` unchanged. `api/generate.ts` handler `client` param widens to `KVClient & CounterClient`
  (source-compatible for all existing callers — the real `kv` and the test fake satisfy both).
- **Runtime:** every `POST /api/generate` now performs up to two KV `incr` (+ at most two `expire` on
  window open) before the model call. Small added latency; no new dependency.
- **Config:** two new env vars read through `lib/env.ts` only.

### Risks / open questions

- Header-derived IP is spoofable — explicitly accepted by spec 0005 (no-abuse assumption).
- TTL/day-boundary correctness — covered by clock-mocked tests; the key itself is date-stamped so a
  lingering TTL is never re-read next day.
- Cached/dedup hits also count toward the daily counters (enforcement precedes dedup). Accepted: it
  only ever blocks *earlier*, never under-protects spend, and keeps the wiring simple per the spec's
  "at the top of /api/generate".

### ADR

`docs/decisions/0003-rate-limiting.md` (accepted).
