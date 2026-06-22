# Reading site

> Status: approved
> Owner: @jacobwu-b
> Last updated: 2026-06-17

## Problem

The current frontend is a static grid that reads a committed `books-index.json` and links to
hand-authored per-book HTML pages. There is no way for a visitor to request a new brief, and each
brief page carries its own duplicated copy of the design-system CSS. To deliver the core flow the
site needs a submission surface and a single data-driven render path for briefs sourced from the API.

## Goals

- A visitor can submit a title (and optional author) and see the resulting brief.
- A single template renders any Brief JSON, preserving the existing Fraunces/Inter design system and
  dark mode — no per-brief duplicated markup.
- The gallery grid is populated from the API, with the existing search/filter/category UX intact.
- The frontend stays static HTML/CSS/vanilla JS — no framework or client state library.

## Non-goals

- Generating or persisting briefs (specs `0001`, `0002`).
- Migrating existing briefs into the store (spec `0004`).
- Auth, profiles, or per-user history.

## Users / actors

- An anonymous visitor: browses the gallery, opens a brief permalink, and submits a new book.

## Acceptance criteria

- [ ] The submit page posts title/author to `/api/generate`, shows a loading state, renders the
      returned brief on success, and shows an error state on failure.
- [ ] `brief.html?slug=…` fetches `/api/briefs/[slug]` and renders all sections (thesis, insights,
      pull quote, watch-outs, comparison, apply-this, reflection questions) with dark-mode support;
      a missing slug shows a 404 state.
- [ ] The rendered brief has visual parity with the current hand-built briefs.
- [ ] `index.html` populates the grid from `/api/briefs` and preserves search, filter, and category
      behavior.
- [ ] On successful generation, the submit flow routes to `brief.html?slug=…`.
- [ ] When KV is unconfigured (ADR-0007), a brief the visitor generates persists in their browser
      (`localStorage`): it appears in their gallery merged on top of `/api/briefs` (API/KV winning on
      slug), survives a refresh, and its permalink renders after a refresh — see ADR-0009. This is
      per-browser, not cross-device.

## Non-goals / out of scope

- Redesign of the visual system; this reuses the existing tokens and layout.
- Server-side rendering; pages fetch JSON client-side.

## Approach

Extract the shared brief styles into `assets/brief.css` and a renderer into `assets/brief.js` that
turns a Brief object into the existing markup. `generate.html` is the submission surface (and the
Milestone-1 demo render target); `brief.html` is the permalink view that fetches by slug;
`index.html` is reworked to read `/api/briefs`. All three are plain HTML loading the shared assets.

## Out of scope

- Client-side caching of API responses beyond the browser default. (Distinct from the no-KV
  `localStorage` persistence of *generated* briefs above, which is a fallback store, not response
  caching — ADR-0009.)

## Open questions

- None blocking.

## Risks

- Visual parity with the bespoke briefs requires careful extraction of the existing CSS → compare
  against a current brief during review.

## References

- Existing `index.html` and `books/*/index.html`, `CLAUDE.md` §6 (state invariant: static frontend),
  specs `0001`, `0002`.
