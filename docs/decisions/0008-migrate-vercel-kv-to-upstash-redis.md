# ADR-0008: Migrate the datastore client from @vercel/kv to @upstash/redis

> Status: accepted
> Date: 2026-06-20
> Deciders: @jacobwu-b

## Context

ADR-0002 fixed Vercel KV as the datastore and `CLAUDE.md` §6 routes all persistence through
`lib/kv.ts`, the sole importer of the SDK. We reached it through the `@vercel/kv` package.

Vercel has since retired Vercel KV: `@vercel/kv@3.0.0` now emits a deprecation warning on every
install pointing users to Upstash Redis, and existing KV stores were moved to Upstash under Vercel's
Marketplace integration (issue #52). The package is end-of-life and will not see fixes.

Critically, `@vercel/kv` is a thin wrapper: `@vercel/kv@3.0.0` depends on `@upstash/redis@^1.34.0`
and re-exports a lazily-constructed client over the same REST credentials. So `@upstash/redis` is
already a transitive dependency, and the credentials we run on (`KV_REST_API_URL` /
`KV_REST_API_TOKEN`) are Upstash REST credentials — that is what Vercel KV became. The only thing the
wrapper adds is auto-detecting those env vars and presenting a singleton.

## Decision

We will depend on `@upstash/redis` directly and drop `@vercel/kv`.

`lib/kv.ts` constructs an `@upstash/redis` `Redis` client from the credentials exposed by the config
layer (`lib/env.ts`, new `kvCredentials()`), preserving the §6 invariant that env vars are read only
in `lib/env.ts`. The client is built **lazily** on first method use — `@vercel/kv`'s singleton was a
lazy proxy, but `new Redis(...)` throws when url/token are absent, so eager construction would break
ADR-0007's unconfigured-KV degradation. A small delegating default client defers construction until a
helper actually reaches the datastore, which only happens after the `isKVConfigured()` short-circuit.

No env vars change. No data migrates — the same Upstash-backed store and keyspace (ADR-0002) are
reused. The narrowed `KVClient` / `CounterClient` interfaces are unchanged, so every consumer and
every injected test fake is untouched: `@upstash/redis` exposes the same `get`/`set`/`hset`/
`hgetall`/`hkeys`/`incr`/`expire` with the same JSON (de)serialization.

## Consequences

What becomes easier, what becomes harder, what's now load-bearing.

**Positive**
- The deprecation warning is gone; we depend on the maintained package directly.
- One fewer layer — `@upstash/redis` was already pulled in transitively, so this is a net
  simplification, not a new dependency surface.

**Negative**
- `lib/kv.ts` now owns client construction (credentials + lazy init) that the wrapper handled.
- A future move off Upstash is a real client swap again, though still contained to `lib/kv.ts`.

**Neutral**
- `@upstash/redis` becomes a direct dependency, pinned `^1.34.0` (the range `@vercel/kv` used).

## Alternatives considered

### A: Stay on @vercel/kv and silence the warning

Suppressing the install warning leaves us on an end-of-life package that will not be patched, and
keeps a redundant wrapper over the client we already pull in. It defers the swap without removing the
risk.

### B: Migrate to a Vercel Marketplace Redis integration with new env vars

Standing up a fresh integration and adopting its env-var names (e.g. `UPSTASH_REDIS_REST_URL`) would
churn `lib/env.ts`, `.env.example`, and the Vercel project for no functional gain — our existing
`KV_REST_API_*` credentials already point at the Upstash store. Rejected as unnecessary migration.

## References

- ADR-0002 (KV keyspace), ADR-0007 (KV optional / graceful degradation)
- Issue #52 — `@vercel/kv` deprecation warning
- `@vercel/kv@3.0.0` → depends on `@upstash/redis@^1.34.0`
