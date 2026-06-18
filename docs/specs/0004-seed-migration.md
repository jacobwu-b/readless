# Seed migration

> Status: approved
> Owner: @jacobwu-b
> Last updated: 2026-06-17

## Problem

There are 10 curated briefs already in the repo as bespoke `books/{slug}/index.html` pages, indexed
by `books-index.json`. Once briefs are served from the store through a single template, these pages
become a second, divergent render path. They must move into the new JSON store so the catalog is
preserved without duplicated markup — and the old files must be retired so there is exactly one path.

## Goals

- Each of the 10 existing briefs becomes a schema-valid Brief in `data/seeds.json`, carrying its
  existing metadata (author, year, category, tags, cover, read time).
- The migration preserves the curated editorial content rather than regenerating it.
- After migration, all 10 briefs render through the new template, and the old per-book HTML and
  `books-index.json` are removed.

## Non-goals

- Changing the editorial content of the existing briefs.
- Generating new briefs via the model (spec `0001`).
- Building the store or the render template (specs `0002`, `0003`).

## Users / actors

- A maintainer running the migration script once, offline (`npm run migrate`).

## Acceptance criteria

- [ ] The migration parses thesis, key insights, pull quote, watch-outs, concept comparison,
      apply-this, and reflection questions from a representative brief fixture.
- [ ] Every produced seed validates against the Brief schema.
- [ ] Metadata (author, year, category, tags, cover, read time) is carried from `books-index.json`.
- [ ] The migration flags any section it cannot map, rather than dropping it silently.
- [ ] `data/seeds.json` contains all 10 briefs (guard test).
- [ ] After retirement, `books/{slug}/index.html` and `books-index.json` are removed and all 10
      briefs still resolve via `brief.html?slug=…`.

## Approach

`scripts/migrate-briefs.ts` parses each existing page (using the consistent section structure from
`book-summary-prompt.md`) into the Brief shape, merging metadata from `books-index.json`, validates
each against `lib/schema.ts`, and writes `data/seeds.json`. Unmappable sections are reported for
manual fill — never silently dropped. A separate retirement step deletes the old files and adds
redirects for any lingering `/books/{slug}/` links.

## Out of scope

- Re-authoring or improving the existing briefs' content.

## Open questions

- Whether any of the 10 pages deviate enough from the standard structure to need manual fill — the
  parser surfaces these; resolve case-by-case during implementation.

## Risks

- The pages vary; naive parsing loses content → fixture-driven parser with explicit unmapped-section
  flagging.
- Dangling links to old `/books/{slug}/` paths → add rewrites in the retirement step.

## References

- `books/*/index.html`, `books-index.json`, `book-summary-prompt.md`, specs `0002`, `0003`.
