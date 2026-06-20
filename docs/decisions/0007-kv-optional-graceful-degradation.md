# ADR-0007: Vercel KV is optional — unconfigured KV degrades to a seed-only store

> Status: accepted
> Date: 2026-06-20
> Deciders: @jacobwu-b

## Context

ADR-0002 fixed Vercel KV as the datastore and `CLAUDE.md` §6 routes all persistence through
`lib/kv.ts`. Issue #26 then made the helpers *fail fast*: a missing `KV_REST_API_URL`/
`KV_REST_API_TOKEN` threw a clear error rather than an opaque SDK failure.

In practice the production Vercel project has **no KV store configured**, and standing one up was
deemed not worth the cost for now (issue #49). With fail-fast, that absence is fatal: every endpoint
500s, so the gallery (`GET /api/briefs`), permalinks (`GET /api/briefs/:slug`, even for static
seeds), and generation (`POST /api/generate`) all break — the entire product fails to load. Yet the
store already merges a committed seed catalog (`data/seeds.json`) at read time, so the data to run a
useful read-only site is right there; only the throw stands in the way.

We need the product to work end-to-end with no KV configured — browse the seeded gallery, open a
brief, and generate a new one — while leaving KV as a drop-in for the future.

## Decision

We will make Vercel KV **optional**. `lib/env.ts` gains `isKVConfigured()` (the REST URL + token,
read live from `process.env` at the config layer), replacing the fail-fast `validateKVConfig()`.

When the real `@vercel/kv` client is in use *and* KV is unconfigured, every `lib/kv.ts` helper
short-circuits before touching the datastore:

- reads return empty — `get`→`null`, `listIndex`→`{}`, `indexSlugs`→`[]`
- writes are dropped silently — `set`, `addToIndex`, `expire` are no-ops
- `incr` returns `0`, so the rate limiter treats every request as under-limit

Injected clients (tests) are unaffected and always reach their fake. Downstream this means
`lib/store.ts` serves seeds for the gallery and permalinks, and `createBrief` still returns a usable
brief that simply isn't persisted. The frontend stashes a freshly generated brief in
`sessionStorage` and the brief page renders from it before falling back to the API, so
"generate → view the summary" works without a store.

This supersedes the issue-#26 fail-fast behavior. KV remains the sole persistence surface owned by
`lib/kv.ts` (ADR-0002 unchanged); configuring the `KV_*` vars restores full persistence with no code
change.

## Consequences

What becomes load-bearing: `isKVConfigured()` now gates the read/write path, and the seed catalog is
the product's baseline content rather than just a pre-generation placeholder.

**Positive**
- The product loads and is fully browsable with zero KV configuration — the #49 blocker is gone.
- KV is a pure drop-in: set the `KV_*` vars and persistence + dedup + rate limiting light up, no code
  change.
- The seed-only path is exercised by tests, so the degraded mode is a supported configuration, not an
  accident.

**Negative**
- Without KV, generated briefs are **ephemeral**: not persisted, absent from the gallery, and visible
  only in the generating session (via `sessionStorage`).
- Without KV, the daily rate limits and global spend cap (spec 0005 / ADR-0003) **cannot be
  enforced** — `ANTHROPIC_API_KEY` presence is the only gate on model spend. Acceptable only because
  the unconfigured-KV deployment is single-operator and low-traffic; standing up KV restores the cap.
- A misconfigured KV (vars genuinely intended but mistyped) now degrades silently instead of throwing
  — we trade the #26 loud-failure for graceful degradation.

**Neutral**
- The keyspace and `lib/kv.ts` ownership (ADR-0002, ADR-0005) are unchanged; this is purely about
  what happens when the store is absent.

## Alternatives considered

### A: Keep fail-fast and require KV in production

The status quo. Rejected: it makes a store we've chosen not to provision a hard dependency, leaving
the product unusable — the exact problem #49 raises.

### B: A filesystem or in-memory fallback store

Persist briefs to disk or a process-global map when KV is absent. Rejected: Vercel serverless
filesystems are read-only at runtime (already noted in ADR-0002), and an in-memory map does not
survive across invocations or instances, so neither delivers real cross-user persistence. They would
add a second storage code path for no durable benefit; `sessionStorage` covers the one case that
matters (viewing what you just generated) with far less surface.

### C: An explicit `KV_ENABLED` feature flag

A dedicated boolean to toggle KV. Rejected as redundant: the presence of the `KV_*` connection vars
*is* the signal, and a separate flag invites the inconsistent state where it disagrees with whether
the vars are set.

## References

- Issue #49 (KV optional), issue #26 (the fail-fast this supersedes).
- ADR `0002-kv-keyspace` (KV as the datastore, `lib/kv.ts` ownership), ADR `0003-rate-limiting`,
  ADR `0005-gallery-projection-index`.
- Spec `0002-brief-store`, `0005-abuse-controls`; `CLAUDE.md` §6.
