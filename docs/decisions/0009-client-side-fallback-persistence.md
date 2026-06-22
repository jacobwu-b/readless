# ADR-0009: Client-side localStorage as the brief fallback store when KV is unconfigured

> Status: accepted
> Date: 2026-06-21
> Deciders: @jacobwu-b

## Context

ADR-0007 made Vercel KV optional: with no KV configured, `lib/kv.ts` reads return empty and writes
are dropped, so the brief store serves the committed seed catalog and `createBrief` returns a usable
brief that simply isn't persisted. To keep "generate → view the summary" working without a store,
the frontend stashes the freshly generated brief in `sessionStorage` and the permalink renders from
it before falling back to the API.

That left one accepted gap, recorded as a negative consequence of ADR-0007:

> Without KV, generated briefs are **ephemeral**: not persisted, absent from the gallery, and visible
> only in the generating session (via `sessionStorage`).

The gap is now a problem: the no-KV deployment is the *actual* running configuration (issue #49), and
in it a user generates a brief, lands on its permalink, returns to the gallery — and their brief is
gone. The fallback is meant to work end-to-end, and "shows up in the gallery" is part of end-to-end.

ADR-0007 already rejected server-side fallback stores (its Alternative B): Vercel serverless
filesystems are read-only at runtime and an in-memory map does not survive across invocations or
instances, so neither delivers persistence a *later* `GET /api/briefs` request could read back. That
reasoning is unchanged. Without a shared datastore, the only place a generated brief can persist is
the client that generated it.

## Decision

When KV is unconfigured, **the browser's `localStorage` is the fallback persistence surface for
briefs the user generated**, and the gallery merges those local entries on top of the API's list.

Concretely, on the frontend (static vanilla JS, no framework — CLAUDE.md §6 unchanged):

- On successful generation, `generate.js` writes two `localStorage` records: the full brief under
  `brief:{slug}`, and the brief's `IndexEntry` projection upserted into a `briefs:local` list
  (dedup by slug). This widens the existing `sessionStorage` stash into a durable per-browser store.
- `index.js` merges `briefs:local` into the `GET /api/briefs` result, with **API/KV entries winning
  on slug collision** — mirroring the seed ∪ KV merge `lib/store.ts` `listBriefs` already performs.
- `brief.html` (`brief-page.js`) reads `localStorage` before `sessionStorage` before the API, so a
  generated brief's permalink survives a page refresh, not just the originating navigation.

The merge is identity-safe when KV *is* configured: a persisted brief comes back from the API, so the
API copy wins and the local entry never double-renders. There is one frontend code path regardless of
whether the store is present.

This supersedes only the ADR-0007 consequence quoted above ("absent from the gallery … visible only
in the generating session"). Everything else in ADR-0007 stands.

## Consequences

What becomes load-bearing: the `briefs:local` localStorage key and the `brief:{slug}` localStorage
record are now part of the frontend's data contract, read by both the gallery and the permalink view.

**Positive**
- The no-KV fallback works end-to-end within a browser: generate, see it in the gallery, refresh,
  reopen the permalink — all without a store.
- One frontend code path: the merge and the localStorage stash are inert-but-harmless when KV is on
  (API copy wins), so there is no "fallback mode" branch to keep in sync.
- No new dependency and no infra: pure client-side, consistent with the static-frontend invariant.

**Negative**
- Persistence is **per-browser, not cross-device or cross-user**: a brief generated in one browser
  never appears in another, and clearing site data loses it. Inherent to having no shared store;
  acceptable under the single-operator, low-traffic assumption ADR-0007 already adopts. Standing up
  KV restores durable, shared persistence with no frontend change (the API copy then wins).
- `localStorage` has a finite quota (~5 MB). A heavy no-KV session could in principle fill it; writes
  are wrapped so a quota failure degrades to the prior session-only behavior rather than breaking
  generation. No eviction policy ships now — revisit only if it bites.
- The gallery's content is no longer a pure function of the API in the no-KV case; it depends on the
  viewing browser's history. Documented in spec 0003.

**Neutral**
- The KV keyspace and `lib/kv.ts` ownership (ADR-0002, ADR-0005) are untouched; this lives entirely
  in the frontend and changes nothing server-side.

## Alternatives considered

### A: Leave the gap as ADR-0007 accepted it

Do nothing; generated briefs stay absent from the gallery without KV. Rejected: the no-KV deployment
is the live configuration, so the gap is a user-facing dead end on the core flow, not a theoretical
edge.

### B: A server-side fallback store (filesystem / in-memory)

Reconsidered and re-rejected for the same reasons as ADR-0007 Alternative B: read-only serverless
filesystem at runtime, and per-instance memory that does not survive across invocations — neither
lets a later `/api/briefs` read see the brief. localStorage covers the one case that matters (the
generating user's own gallery) with no server surface.

### C: Provision KV

The "real" fix for cross-device persistence, and a zero-frontend-change drop-in (ADR-0007). Out of
scope here by explicit decision (issue #49: not worth the cost yet). This ADR is what makes the
*interim* no-KV configuration whole; it does not preclude provisioning KV later.

## References

- ADR `0007-kv-optional-graceful-degradation` (the consequence this supersedes), ADR
  `0002-kv-keyspace`, ADR `0005-gallery-projection-index`.
- Spec `0002-brief-store`, `0003-reading-site`; issue #49; `CLAUDE.md` §6.
