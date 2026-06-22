# Plan: feat/web-local-fallback-gallery

> Size: M (architectural-risk: amends an accepted ADR consequence; new client-side pattern)
> Spec: docs/specs/0003-reading-site.md
> Author: @jacobwu-b
> Status: approved

## Branch

`feat/web-local-fallback-gallery`

## What

Surface a user's locally-generated briefs in the gallery (and on refresh of their permalink) when KV
is unconfigured, by widening the existing `sessionStorage` stash into a durable per-browser
`localStorage` store that the gallery merges on top of the API.

## Files

- `docs/decisions/0009-client-side-fallback-persistence.md` — new ADR; supersedes the ADR-0007
  "absent from the gallery" consequence.
- `docs/decisions/0007-kv-optional-graceful-degradation.md` — mark the superseded consequence,
  forward-link to 0009.
- `docs/specs/0003-reading-site.md` — record the no-KV gallery/permalink fallback behavior and
  clarify the existing "client-side caching out of scope" line.
- `assets/generate.js` — on success, write `localStorage['brief:{slug}']` (full brief) and upsert the
  `IndexEntry` projection into the `briefs:local` list (dedup by slug).
- `assets/index.js` — merge `briefs:local` into the `/api/briefs` result; API/KV wins on slug.
- `assets/brief-page.js` — read `localStorage` before `sessionStorage` before the API fetch.

## Approach

- The browser becomes the fallback persistence surface (ADR-0009). `generate.js` already stashes the
  full brief in `sessionStorage`; widen that to `localStorage` and additionally maintain a
  `briefs:local` list of gallery projections so the gallery has a cheap source without parsing every
  full brief.
- `index.js` merges local entries under the API list with the same seed ∪ KV precedence
  `lib/store.ts` `listBriefs` uses — API/KV entry wins on slug collision, so the path is identity-safe
  when KV is configured (no duplicate, API copy authoritative).
- All localStorage access is wrapped: a quota/availability failure degrades to the prior
  session-only behavior and never breaks generation or gallery load. Rendered values keep flowing
  through the existing `escapeHtml`.

## Tests

- None automated. The frontend (`assets/*.js`) is plain browser script with no test harness — the
  runner globs only `**/*.test.ts` (lib/ and api/), and there is no jsdom. Adding a frontend test
  framework is a new dependency, out of scope for this PR (CLAUDE.md §6/§7: frontend treated as
  wiring → manual verify, noted in PR).
- Manual verification (see Manual steps). Server-side behavior is unchanged, so the existing
  `lib`/`api` suites remain the contract for the store and endpoints and must stay green.

## Manual steps

Env: none (works against the current KV-unconfigured `.env.local`). With KV unconfigured, via
`vercel dev`:

1. Generate a brief → routed to its permalink → brief renders.
2. Navigate to `/` → the new brief appears as a gallery card alongside the seeds.
3. Refresh `/` → the brief is still there. Refresh the permalink → still renders.
4. Generate a second brief → both appear in the gallery.
5. Confirm seeds still render and search/filter/category still work.
6. (Identity-safety) With KV configured, generate → confirm the gallery shows exactly one card for
   the brief (API copy, no local duplicate).

---

## Full-plan additions

### Blast radius

- **Consumers:** the gallery (`index.html`/`assets/index.js`) and the permalink view
  (`brief.html`/`assets/brief-page.js`); the submit flow (`assets/generate.js`). No server code.
- **Schemas/types:** introduces a frontend-only data contract — the `briefs:local` localStorage key
  (a list of `IndexEntry`-shaped objects) and `brief:{slug}` localStorage records (full `Brief`).
  Mirrors existing shapes; no KV keyspace or `lib/` type change.
- **Runtime:** when KV is on, behavior is unchanged (API wins the merge). When KV is off, the gallery
  becomes a function of the API list plus the viewing browser's generation history.
- **Observability:** none added; frontend has no logger.

### Risks / open questions

- **localStorage quota (~5 MB).** A heavy no-KV session could fill it. Mitigation: wrap writes so a
  failure is non-fatal (falls back to session-only). No eviction policy now; revisit only if it bites.
- **Stale local copy when KV is later provisioned.** A locally-stored brief whose slug also exists in
  KV is shadowed by the API copy (correct), but the local record lingers. Harmless; could add a prune
  later. Not blocking.
- **Per-browser only.** Accepted and documented (ADR-0009); cross-device requires KV.

### ADR

`docs/decisions/0009-client-side-fallback-persistence.md`.
