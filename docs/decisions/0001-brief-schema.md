# ADR-0001: Brief is the canonical persisted record, defined by a zod schema

> Status: accepted
> Date: 2026-06-17
> Deciders: @jacobwu-b

## Context

ReadLess is moving from hand-authored HTML briefs to generated, stored, and rendered briefs. Every
layer — generation, persistence, API, and frontend — needs to agree on one shape for "a brief."
`CLAUDE.md` §6 requires that every model response be validated by a `zod` schema before use, and
treats any persistent-schema definition as an architectural-risk change. The brief shape is also the
persisted record (it is what we store in KV and what seeds serialize to), so getting it wrong is
expensive to change later. The editorial structure is already defined informally in
`book-summary-prompt.md` (core thesis, 5 key insights, pull quote, watch-outs, concept comparison,
apply-this, reflection questions, plus metadata).

## Decision

We will define a single `Brief` zod schema in `lib/schema.ts` as the canonical contract for brief
shape, and it is also the persisted record shape. Generation validates model output against it,
the store serializes it, the API returns it, and the frontend renders it. Section counts the model
cannot be forced to honor server-side (e.g. exactly 5 key insights) are enforced in the zod schema.
The schema is strict (unknown fields rejected). Metadata (slug, title, author, year, category, tags,
cover, readTime, dateAdded) lives on the same record alongside the editorial sections.

The enforced section counts are exported as `COUNTS` from `lib/schema.ts` (the prompt builder reads
the same constants, so the two cannot drift): `keyInsights` exactly 5 and `reflectionQuestions`
exactly 4 (prompt and existing corpus agree); `watchOutFor` 3–4; `applyThis` 3–5; `comparison`
optional with at least 2 columns and 2 rows, each row one cell per column. The `applyThis` minimum is
widened from the prompt's 4 to 3 so the existing curated briefs (e.g. *Sapiens*, which has 3) migrate
under `0004-seed-migration` without editorial changes — that migration's stated non-goal.

## Consequences

**Positive**
- One source of truth for brief shape across all layers; type inference flows from the schema.
- Invalid model output is caught at the boundary, never persisted or rendered.
- Frontend can render any brief generically — no per-brief markup.

**Negative**
- Schema changes are now architectural-risk events: a change ripples to generation, store, seeds,
  API, and template, and any persisted briefs need a migration.
- Strict counts may reject otherwise-usable model output, forcing a retry.

**Neutral**
- The schema embeds editorial decisions (how many insights, which sections) that previously lived
  only in the prompt.

## Alternatives considered

### A: Loose/optional schema (validate only that it's JSON)

Accept whatever the model returns and let the frontend cope. Rejected: violates `CLAUDE.md` §6, pushes
validation into the UI, and makes the persisted data untrustworthy.

### B: Separate schemas per layer (generation DTO vs storage record vs API response)

More flexibility per layer. Rejected for the MVP: three schemas to keep in sync for no current
benefit; the shapes are identical today. Revisit if/when an API response needs to diverge from the
stored record.

## References

- Spec `0001-brief-generation`, `book-summary-prompt.md`, `CLAUDE.md` §6.
