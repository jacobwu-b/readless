# Brief generation

> Status: approved
> Owner: @jacobwu-b
> Last updated: 2026-06-17

## Problem

ReadLess briefs are produced by hand: a person pastes `book-summary-prompt.md` into Claude, copies
the output into a new `books/{slug}/index.html`, and edits the index by hand. That is slow, serial,
and impossible to expose to a reader. There is no programmatic way to turn a book title into a
brief, so the product cannot offer the core flow — "type a book, get a brief."

## Goals

- Given a book title (and optional author), the system produces a single structured Brief object.
- The Brief is validated against a fixed schema before anything downstream uses it.
- Brief content preserves the editorial substance of `book-summary-prompt.md`: core thesis, key
  insights, a pull quote, watch-outs, a concept comparison, apply-this actions, reflection questions,
  plus metadata (author, year, category, tags, read time, cover).
- Generation runs server-side only; the Anthropic key never reaches the browser.

## Non-goals

- Persisting or listing briefs (see `0002-brief-store`).
- Any frontend rendering (see `0003-reading-site`).
- Rate limiting, spend caps, or input hardening (see `0005-abuse-controls`).
- Streaming partial briefs to the client; the endpoint returns a complete Brief.

## Users / actors

- An anonymous visitor who submits a title (and optionally an author) through the site. No accounts,
  single shared instance.

## Acceptance criteria

- [ ] The Brief zod schema accepts a well-formed brief and rejects one missing a required section.
- [ ] The Brief schema rejects unknown extra fields.
- [ ] The prompt builder embeds the schema contract and is deterministic for the same inputs.
- [ ] `generateBrief(title, author?)` returns a typed Brief for a valid model response.
- [ ] `generateBrief` throws a typed error on invalid JSON or schema-mismatched output.
- [ ] `POST /api/generate` returns 200 + Brief for a valid body, 400 for a missing title, 405 for a
      non-POST method, and 502 when generation fails.

## Approach

A zod `Brief` schema (`lib/schema.ts`) is the single contract for brief shape; the system prompt
(`lib/prompt.ts`) is `book-summary-prompt.md` rewritten to emit JSON conforming to that schema
(presentation rules dropped — those move to the frontend template). `lib/anthropic.ts` wraps
`@anthropic-ai/sdk` using the config layer; `lib/generate.ts#generateBrief` calls the model
(Claude Opus 4.8, structured output, streamed for headroom), then validates the response with the
schema and returns a typed Brief or a typed error. `api/generate.ts` is a thin handler over
`generateBrief`. Counts the model can't enforce server-side (e.g. exactly 5 insights) are enforced
in zod.

## Out of scope

- Cover-image lookup beyond passing through an ISBN the model supplies.
- Editing or regenerating an existing brief.

## Open questions

- None blocking. Model latency is handled via `maxDuration` + streaming (see Risks).

## Risks

- Model output may be inconsistent or violate the schema → strict zod validation + typed errors;
  prompt fixtures in tests; evals later.
- Opus + adaptive thinking can exceed the default function timeout → set `maxDuration` and stream
  with `.finalMessage()`.
- `stop_reason: "refusal"` must be handled rather than read as content.

## References

- `book-summary-prompt.md` (editorial source), `CLAUDE.md` §6 (external-call invariant),
  ADR `0001-brief-schema`.
