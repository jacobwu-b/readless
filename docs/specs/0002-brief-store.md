# Brief store

> Status: approved
> Owner: @jacobwu-b
> Last updated: 2026-06-17

## Problem

A generated brief is useless if it evaporates at the end of the request. Today there is no
persistence layer at all — briefs live as committed HTML files. For an end-to-end app, a generated
brief must be saved, addressable by a stable slug, listable for the gallery, and cheap to re-serve.
Without dedup, identical requests would re-pay the model cost every time.

## Goals

- A generated Brief is persisted in Vercel KV under a stable, human-readable slug.
- A brief can be fetched by slug, and all briefs can be listed as lightweight index entries.
- An identical request (same normalized title + author) returns the existing brief without calling
  the model.
- All KV access goes through `lib/` helpers; no `api/` handler touches `@vercel/kv` directly.

## Non-goals

- Generating brief content (see `0001-brief-generation`).
- Frontend rendering of stored briefs (see `0003-reading-site`).
- Migrating the existing curated briefs (see `0004-seed-migration`).
- Editing, deleting, or versioning stored briefs.

## Users / actors

- The generation endpoint (writer), and anonymous visitors browsing the gallery and permalinks
  (readers). Single shared instance.

## Acceptance criteria

- [ ] `saveBrief` then `getBrief` round-trips a brief through KV.
- [ ] `listBriefs` merges KV-stored briefs with static seeds, de-duplicated by slug.
- [ ] `listBriefs` reads the gallery index in O(1) KV round-trips — one index read, no per-slug
      full-brief fetches — regardless of corpus size (ADR-0005).
- [ ] `getBrief` falls back to a seed when KV has no entry, and returns null for an unknown slug.
- [ ] `slugify` is deterministic and disambiguates collisions.
- [ ] A repeat (title|author) generate request returns the cached brief without calling the model;
      the cache key normalizes case, surrounding whitespace, and a missing author.
- [ ] `GET /api/briefs` returns the index entry list; `GET /api/briefs/[slug]` returns the full
      brief or 404.
- [ ] No `api/` handler imports `@vercel/kv` directly (guard).

## Approach

`lib/kv.ts` is the only module importing `@vercel/kv` and owns the keyspace (`brief:{slug}` for full
briefs, a `briefs:gallery` hash of `IndexEntry` projections for listing, and a `cache:{key}` → slug
map for dedup) — see ADRs `0002-kv-keyspace` and `0005-gallery-projection-index`. `saveBrief` writes
both the full brief and its gallery projection so `listBriefs` is one `HGETALL`, not an N+1.
`lib/store.ts` builds `saveBrief`/`getBrief`/`listBriefs` on top, merging KV with
static seeds from `data/seeds.json`; `lib/slug.ts` produces slugs. `lib/cache.ts` normalizes the
request into a cache key and maps it to a slug. `api/generate.ts` gains persistence + cache lookup;
`api/briefs/*` expose read endpoints.

## Out of scope

- Pagination of the gallery (list returns all; volume is small).
- Cross-instance cache invalidation.

## Open questions

- None blocking. Concurrent identical requests may both generate once (stampede) — accepted under
  the no-abuse assumption; noted in the implementing PR.

## Risks

- KV keyspace is load-bearing and awkward to change later → minimal surface, fixed in ADR 0002.
- Seed/KV merge ordering and dedup must be deterministic → covered by tests.

## References

- ADR `0002-kv-keyspace`, `CLAUDE.md` §6 (data-access invariant), spec `0001-brief-generation`.
