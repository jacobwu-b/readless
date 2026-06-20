# ADR-0002: Vercel KV keyspace and access pattern behind lib/kv.ts

> Status: accepted (the `briefs:index` gallery-listing decision is superseded by ADR-0005)
> Date: 2026-06-17
> Deciders: @jacobwu-b

## Context

Generated briefs must persist somewhere serverless-friendly. The stack already fixes Vercel KV as
the datastore (`CLAUDE.md` §6, `README.md`), and §6 requires all reads/writes to go through `lib/`
helpers — never `@vercel/kv` directly from an `api/` handler. We need to commit to a keyspace: how
briefs are keyed, how the gallery lists them, and how identical requests dedup. KV has no schema, so
the keyspace *is* the schema, and it is load-bearing — clients across generation, reads, and the
gallery will encode these keys, making later change costly.

## Decision

We will introduce `lib/kv.ts` as the sole importer of `@vercel/kv` and the owner of the keyspace:

- `brief:{slug}` → the full serialized `Brief` JSON.
- An index set (`briefs:index`) of slugs, used to list the gallery. *(Superseded by ADR-0005: the
  gallery now reads a `briefs:gallery` hash of `IndexEntry` projections in one call; the slug set is
  retired.)*
- `cache:{normalizedKey}` → slug, mapping a normalized (title|author) request to an existing brief
  for dedup.

`lib/kv.ts` exposes typed primitives (get/set/list/add-to-index); higher-level logic
(`lib/store.ts`, `lib/cache.ts`) builds on those. A guard test asserts no `api/` handler imports
`@vercel/kv`. Static seeds live in `data/seeds.json` and are merged at read time (KV wins on slug
collision).

## Consequences

**Positive**
- A single, auditable persistence surface; the rest of the app is storage-agnostic.
- Dedup is a cheap key lookup; the gallery is one index read.
- The guard test enforces the `CLAUDE.md` §6 invariant mechanically.

**Negative**
- The keyspace is now a contract; renaming keys or changing the index shape is a migration.
- Merging seeds with KV at read time adds a small, ongoing reconciliation cost.

**Neutral**
- Choosing KV (key-value) over a relational store rules out ad-hoc queries; acceptable for a
  slug-addressed brief catalog.

## Alternatives considered

### A: Call `@vercel/kv` directly from handlers

Less indirection. Rejected: violates `CLAUDE.md` §6 and scatters the keyspace across handlers,
making it impossible to evolve safely.

### B: Store briefs as committed JSON files instead of KV

Simpler locally and free. Rejected: Vercel serverless functions have a read-only filesystem at
runtime, so generated briefs could not be written; KV is the fixed-stack answer for runtime writes.

## References

- Spec `0002-brief-store`, `CLAUDE.md` §6, ADR `0001-brief-schema`.
