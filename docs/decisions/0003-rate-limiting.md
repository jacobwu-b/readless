# ADR-0003: Per-IP token bucket + global daily cap on KV counters

> Status: accepted
> Date: 2026-06-17
> Deciders: @jacobwu-b

## Context

`POST /api/generate` calls a paid model with no auth in front of it. The product assumes no
malicious actors but still needs a cheap, low-complexity guard so a loop or a careless client cannot
run up unbounded spend (spec `0005-abuse-controls`). We already have Vercel KV and want to avoid new
dependencies. We need a mechanism that bounds per-client request rate and, more importantly, caps
total daily spend regardless of source.

## Decision

We will implement rate limiting in `lib/ratelimit.ts` using KV counters with TTLs:

- **Per-IP token bucket** — a counter keyed `rl:ip:{ip}:{yyyy-mm-dd}` (or a sliding window),
  incremented per request, expiring daily; over the limit returns `429` with `Retry-After`.
- **Global daily cap** — a counter keyed `rl:global:{yyyy-mm-dd}`; once it reaches the configured
  ceiling, generation is hard-blocked for the rest of the day. This is the real spend backstop.

Limits are configured via env vars (read through `lib/env.ts`, surfaced in `.env.example`) so they
can be tuned without a code change. The IP is taken from the platform-provided forwarded header;
spoofing is explicitly out of scope. Both checks run at the top of `api/generate.ts` before any model
call.

## Consequences

**Positive**
- Worst-case daily spend is bounded by one configurable number.
- No new dependency; reuses the KV layer and its TTLs.
- Limits are env-tunable without redeploringy code logic.

**Negative**
- Header-derived IPs are spoofable, so per-IP limiting is best-effort (accepted by spec `0005`).
- KV counter increments add a small per-request latency and cost.
- Counter/TTL correctness depends on the day-boundary key; clock handling needs tests.

**Neutral**
- A token bucket per IP per day is coarse; finer windows can be added later without changing the
  global-cap design.

## Alternatives considered

### A: No global cap, per-IP only

Simpler. Rejected: per-IP limiting alone does not bound total spend (many IPs, or one spoofed
header), and bounding spend is the primary goal.

### B: A dedicated rate-limit service / library (e.g. Upstash Ratelimit)

More features (sliding windows, analytics). Rejected for the MVP: adds a dependency (an
architectural-risk event needing its own approval) for functionality the KV counters already cover
at this scale.

## References

- Spec `0005-abuse-controls`, ADR `0002-kv-keyspace`, `CLAUDE.md` §6.
