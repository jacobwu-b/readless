# ADR-0005: Gallery projection stored as a `briefs:gallery` hash

> Status: accepted
> Date: 2026-06-19
> Deciders: @jacobwu-b
> Supersedes the `briefs:index` decision in ADR-0002

## Context

`GET /api/briefs` (the homepage gallery) is the hottest read in the app. Under ADR-0002 the gallery
is listed by reading a `briefs:index` set of slugs, then fetching the full `Brief` for each slug to
project it down to a lightweight `IndexEntry` (`lib/store.ts` `listBriefs`). That is an N+1: one
`SMEMBERS` plus one `GET` per slug on **every** homepage load, deserializing the entire editorial
payload only to discard most of it (issue #23, P1). KV round-trips, quota burn, and latency all grow
linearly with the corpus and are paid per page view — at odds with the "fast static reading site"
goal, and a risk against the 60s function budget at large N.

ADR-0002 itself anticipated this: it lists "the gallery is one index read" as a positive consequence.
The index-set shape never delivered that, because the set holds slugs, not the projection. We need the
gallery read to be O(1) round-trips and to carry only the data the gallery renders.

## Decision

We will persist the gallery projection itself, keyed for a single-call read:

- Add `briefs:gallery` — a KV **hash**, field = slug, value = the `IndexEntry` JSON. It is the
  authoritative enumeration of stored (KV) briefs for the gallery.
- `saveBrief` writes the projection (`HSET briefs:gallery {slug} {IndexEntry}`) alongside the full
  `brief:{slug}`. `listBriefs` reads the whole projection in one `HGETALL` and merges it with the
  static seeds — no full-brief fetches. `createBrief` derives its taken-slug set from `HKEYS`.
- This **retires** `briefs:index` (the slug set) as the gallery source. The set is no longer written;
  the new hash is the single source of truth for "which briefs exist."
- A one-shot migration (`scripts/migrate-gallery-index.ts`, backed by `backfillGalleryIndex` in
  `lib/store.ts`) backfills `briefs:gallery` from the legacy `briefs:index` ∪ `brief:{slug}` data.
  The legacy `briefs:index` key is left in place (unreferenced) and removed by a follow-up cleanup
  once the backfill is confirmed in production.

`lib/kv.ts` remains the sole importer of `@vercel/kv` and the owner of the keyspace. It gains hash
primitives (`hset`/`hgetall`/`hkeys`); the `sadd` write path is dropped (no writer remains), and
`smembers` is retained transitionally for the migration read only.

## Consequences

What becomes easier, what becomes harder, what's now load-bearing.

**Positive**
- Gallery read is O(1) KV round-trips (one `HGETALL`) regardless of corpus size; no full-brief
  deserialization on the homepage path.
- The projection stored is exactly what the gallery renders — no fetch-and-discard.
- Quota burn and latency for `/` stop scaling with success.

**Negative**
- The projection is now derived state that must stay in sync with `brief:{slug}`; `saveBrief` owns
  both writes. A brief written outside `saveBrief` would be invisible to the gallery (mitigated: all
  writes go through the store).
- `briefs:gallery` is a new load-bearing key — its shape (`IndexEntry`) is a contract, and changing
  `IndexEntry` becomes a migration.
- One transitional key (`briefs:index`) and one transitional helper (`smembers`-backed legacy read)
  linger until the cleanup issue lands.

**Neutral**
- The hash grows with N, but `HGETALL` returns one row per brief in a single call — the same data the
  gallery needs, without per-slug round-trips. Pagination stays out of scope (spec 0002): volume is
  small.

## Alternatives considered

### A: Per-slug `index:{slug}` rows read with `MGET`

Store each `IndexEntry` under its own key and `MGET` them. Still O(1) round-trips, but needs the slug
set kept alongside (a `SMEMBERS` then an `MGET` — two calls and a redundant enumeration key). The hash
folds enumeration and projection into one key and one call, so it is strictly simpler.

### B: Short-TTL cache of the full `listBriefs` result

Cache the projected list under one key with a short TTL. Cheapest diff, but it introduces a staleness
window after every save and does not fix the cold-read N+1 — the first request after expiry still
fans out. Rejected: it papers over the cost instead of removing it.

### C: Keep `briefs:index` and add the hash redundantly

Leave the set writing as-is and add the gallery hash beside it. Avoids touching `createBrief`, but
keeps two structures encoding the same slugs that must be written in lockstep — exactly the kind of
drift-prone duplication the keyspace is meant to avoid. Rejected for a single source of truth.

## References

- Issue #23 (P1 architecture), spec `0002-brief-store`, ADR `0002-kv-keyspace`, `CLAUDE.md` §6.
