# Plan: perf/gallery-projection-index

> Size: M (trips architectural-risk flag — persistent schema change)
> Spec: docs/specs/0002-brief-store.md
> Author: @jacobwu-b
> Status: approved

## Branch

`perf/gallery-projection-index`

## What

Replace the `briefs:index` slug-set with a `briefs:gallery` hash of `IndexEntry` projections so
`listBriefs` reads the gallery in one `HGETALL` instead of N+1 KV round-trips (issue #23).

## Files

- `docs/decisions/0005-gallery-projection-index.md` — ADR (create; supersedes the index-set part of 0002).
- `docs/decisions/0002-kv-keyspace.md` — note the supersession (modify).
- `lib/kv.ts` — add `keys.gallery`; add `hset`/`hgetall`/`hkeys` to `KVClient`; drop `sadd`; replace
  `addToIndex`/`list` with hash helpers `addToIndex(slug, entry)`, `listIndex`, `indexSlugs`, and a
  transitional `legacyIndexSlugs` (modify).
- `lib/store.ts` — `saveBrief` writes the projection; `createBrief` uses `indexSlugs`; `listBriefs`
  reads `listIndex`; add `backfillGalleryIndex`; export `toIndexEntry` (modify).
- `scripts/migrate-gallery-index.ts` — one-shot backfill wrapper (create).
- `lib/kv.test.ts`, `lib/store.test.ts`, `scripts/migrate-gallery-index.test.ts` — update/add tests.
- `docs/specs/0002-brief-store.md` — Approach + acceptance criterion for O(1) gallery read (modify).

## Approach

- `briefs:gallery` hash (field=slug → `IndexEntry` JSON) becomes the gallery source of truth; the
  full `brief:{slug}` is untouched (permalinks still read it).
- `saveBrief` does both writes; `listBriefs` = one `HGETALL` merged with seeds (KV wins); `createBrief`
  taken-set = `HKEYS`. No full-brief reads on the gallery path.
- Migration backfills the hash from legacy `briefs:index` ∪ `brief:{slug}`; legacy key left for a
  follow-up cleanup issue. `smembers` retained only for that read.

## Tests

- `lib/kv.test.ts`: hash round-trip via `addToIndex`/`listIndex`/`indexSlugs`; `listIndex` empty when
  unset; `keys.gallery`.
- `lib/store.test.ts`: existing round-trip/merge/dedup tests still green against the hash;
  **new** — `listBriefs` issues one index read and zero per-slug `get`s for N stored briefs (O(1)
  guard, the issue's ask); `backfillGalleryIndex` populates the hash from legacy data.
- `scripts/migrate-gallery-index.test.ts`: backfill projects legacy briefs into the gallery hash.

## Manual steps

- Run the migration once against production KV after merge: `npx tsx scripts/migrate-gallery-index.ts`
  (backfills `briefs:gallery` from existing generated briefs). Idempotent. No env/dashboard changes.

---

## Full-plan additions

### Blast radius

- **Schema:** retires `briefs:index` as the gallery source; adds `briefs:gallery` hash. Migration in
  this PR; legacy key removed by follow-up.
- **Consumers:** `api/briefs/index.ts` (via `listBriefs`, signature unchanged), `api/generate.ts`
  (via `createBrief`/`saveBrief`, unchanged). Public API responses unchanged (`IndexEntry[]`).
- **Public types:** `KVClient` gains hash methods, drops `sadd`; `addToIndex` signature gains `entry`.
  Internal to `lib/` + tests + migration.
- **Runtime:** gallery read drops from O(N) to O(1) round-trips; write path adds one `HSET`.

### Risks / open questions

- Projection drift if a brief is written outside `saveBrief` — none today; all writes go through the
  store. If that changes, the gallery would miss the brief (file an issue then).
- Migration must run before the new gallery is correct for pre-existing generated briefs; documented
  as a manual step and idempotent.

### ADR

`docs/decisions/0005-gallery-projection-index.md`.
