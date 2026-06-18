# Plan: feat/brief-schema-and-prompt

> Size: M (arch-risk: defines the persistent Brief record schema)
> Spec: docs/specs/0001-brief-generation.md
> Author: @jacobwu-b
> Status: approved

## Branch

`feat/brief-schema-and-prompt`

## What

Define the canonical `Brief` zod schema (the single contract for brief shape across
generation, store, API, and frontend) and a deterministic system-prompt builder that
instructs the model to emit JSON conforming to it.

## Files

- `lib/schema.ts` — create. The strict `Brief` zod schema + inferred `Brief` type, plus
  exported section-count constants used by both the schema and the prompt (anti-drift).
- `lib/schema.test.ts` — create. Accept a well-formed fixture; reject a missing required
  section; reject unknown extra fields; assert the count bounds.
- `lib/prompt.ts` — create. `buildBriefPrompt(title, author?)` returning the system prompt
  string that embeds the JSON contract and counts; deterministic for fixed inputs.
- `lib/prompt.test.ts` — create. Determinism, contract embedding (field names + counts),
  title/author interpolation.
- `docs/decisions/0001-brief-schema.md` — already exists (accepted); add a short note
  pinning the agreed count bounds so the ADR matches the schema.

## Approach

- Schema mirrors the editorial structure of `book-summary-prompt.md` (presentation rules
  dropped — those live in the frontend template): `thesis`, `keyInsights`, `pullQuote`,
  `watchOutFor`, `comparison` (optional), `applyThis`, `reflectionQuestions`, plus metadata
  (`slug`, `title`, `author`, `year`, `category`, `tags`, `cover`, `readTime`, `dateAdded`).
- Two-level bullet sections (`keyInsights`, `watchOutFor`, `applyThis`) are `{ title, points }`
  objects. `comparison` is `{ label, columns, rows }` with each row length == columns length.
- Count bounds (decided with maintainer — fit corpus + prompt, lossless for J-111 migration):
  `keyInsights` exactly 5, `reflectionQuestions` exactly 4, `watchOutFor` 3–4,
  `applyThis` 3–5 (min widened from prompt's 4 to admit the existing sapiens brief, which
  has 3), `comparison` optional with ≥2 columns and ≥2 rows. Each `points` array 1–4.
- `.strict()` on every object so unknown fields are rejected (ADR requirement).
- Count constants exported from `lib/schema.ts` and interpolated into the prompt text so the
  schema and prompt cannot drift on the numbers.
- `buildBriefPrompt` is a pure function of its inputs — no dates, randomness, or env reads —
  so it is deterministic.

## Tests

- `lib/schema.test.ts`: well-formed fixture parses; dropping `keyInsights` fails; an extra
  top-level key fails; 4 insights fail / 6 fail; 3 apply items pass, 2 fail, 6 fail; a
  comparison row whose length ≠ columns fails; a brief with no `comparison` passes.
- `lib/prompt.test.ts`: identical output for identical inputs (called twice); output contains
  every schema field name and the count numbers; output contains the title and author when
  provided, and omits the author cleanly when absent.

## Manual steps

None. No env vars, migrations, or dashboard changes. (Schema is new — nothing persisted yet.)

---

## Full-plan additions

### Blast radius

- **Consumers (future):** `lib/generate.ts` (J-102) validates model output against this schema;
  `lib/store` (J-106/107) serializes it; `api/*` returns it; the frontend template (0003)
  renders it; `scripts/migrate-briefs.ts` (J-111) must produce seeds that validate against it.
- **Schema/persistence:** this *is* the persisted record shape. Nothing is persisted yet, so
  there is no data migration in this PR; future shape changes are arch-risk events.
- **Public types:** exports `Brief` (inferred) and section-count constants — the type other
  layers import.
- **Runtime:** none yet; pure schema + pure prompt builder. No network, no I/O.

### Risks / open questions

- **Schema/prompt drift** (named in the issue): mitigated by exporting count constants from
  `lib/schema.ts` and interpolating them into the prompt, with a prompt test asserting they
  appear.
- **Structured-output JSON-Schema limits:** the Anthropic structured-output JSON Schema cannot
  express minItems/maxItems, so counts are enforced in zod post-generation (J-102's concern;
  this PR just puts the counts in zod, as specified).
- **Corpus vs. prompt count conflict:** resolved — bounds widened to a superset that accepts
  all existing modern briefs and forward prompt output, keeping J-111 lossless. The 7 older
  briefs use a different markup and are J-111's fixture/manual-fill problem regardless.

### ADR

`docs/decisions/0001-brief-schema.md` — exists and is accepted. This PR adds a short note
pinning the agreed count bounds so the ADR and schema stay in lockstep. No new ADR needed.
