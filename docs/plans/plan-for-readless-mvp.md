# Plan — ReadLess end-to-end web app (MVP decomposition)

> Status: approved
> Type: decomposition plan (precedes sizing of each child unit — see `docs/sizing.md`)
> Specs: `docs/specs/0001`–`0005` · ADRs: `docs/decisions/0001`–`0003`

## Context

ReadLess today is a hand-curated static site: a grid (`index.html`) reads `books-index.json`, and
each brief is a bespoke `books/{slug}/index.html` produced by manually pasting
`book-summary-prompt.md` into Claude. We are turning it into a full end-to-end web app: a user
submits a book title (and optional author), a serverless pipeline generates a structured brief via
the Anthropic API, the brief is persisted, and it is surfaced in the reading site. No auth, no
multi-tenancy, "no malicious actors" simplifications — but a cheap rate-limited security envelope.

**Source of truth:** there is no `PRD.md` in the repo. Per decision, this plan uses the agreed
scope from prior conversation + `CLAUDE.md` §1 as the de-facto PRD. The stack is fixed by
`CLAUDE.md`/`README.md`: TypeScript · Vercel Functions (Node) · Vercel KV · Vercel hosting ·
Anthropic SDK · zod. All required deps are already in `package.json` (no new-dependency ADRs).

**Sizing:** uses the repo-authoritative `Xs–Xl` scale + architectural-risk flag (`docs/sizing.md`).
Process **Tier** maps on: Trivial = Xs/S (proceed direct), Standard = M/L (plan→Spec/TDD loop),
Significant = Xl **or** arch-risk fires (discuss-first + ADR). Acceptance criteria are written
test-name-shaped. CI gate = `tsc --noEmit` + `node --test` on `*.test.ts`.

---

## Spec list (5)

| Spec | Summary |
|---|---|
| `0001-brief-generation` | Title (+ optional author) → structured, schema-valid Brief via the Anthropic API. |
| `0002-brief-store` | Persist briefs in Vercel KV, read/list them, dedup identical requests. |
| `0003-reading-site` | Static frontend: gallery grid, single-brief view from JSON, submission UI. |
| `0004-seed-migration` | Migrate the 10 existing curated briefs into the JSON store; retire per-book HTML. |
| `0005-abuse-controls` | Per-IP rate limiting, global daily generation/spend cap, input validation. |

## ADRs (3 — one per Significant unit)

| ADR | Unit | Decision |
|---|---|---|
| `0001-brief-schema` | 2 | The persisted Brief record shape (canonical data model). |
| `0002-kv-keyspace` | 6 | KV keyspace + access pattern behind `lib/kv.ts`. |
| `0003-rate-limiting` | 14 | Per-IP token-bucket + global daily cap via KV counters. |

---

## Milestones (4)

1. **Tracer bullet — generate a brief end-to-end (ephemeral).** Browser → API → Anthropic →
   zod-validated Brief → rendered. No persistence. Proves the riskiest integration first.
2. **Persistence & reading site.** Briefs persist in KV and are browsable: gallery + permalinks
   from the store, with dedup caching. Fully usable single-user app.
3. **Seed migration.** The 10 curated briefs live in the store via the new template; old per-book
   HTML and `books-index.json` retired.
4. **Abuse controls & hardening.** Rate limiting, global daily cap, input validation, docs.

---

## Units (16) — see Linear issues for the canonical copy

| # | Title | Spec | Tier | Size | Deps | Complexity |
|---|---|---|---|---|---|---|
| 1 | `chore(config): env and logging foundation` | — | Trivial | S | — | haiku |
| 2 | `feat(brief): brief schema and generation prompt` | 0001 | Significant | M (arch-risk) | 1 | opus |
| 3 | `feat(brief): anthropic wrapper and generateBrief` | 0001 | Standard | M | 2 | opus |
| 4 | `feat(api): POST /api/generate endpoint (ephemeral)` | 0001 | Standard | M | 3 | — |
| 5 | `feat(web): minimal submit + render page (tracer)` | 0003 | Standard | S | 4 | haiku |
| 6 | `feat(store): KV access helpers and keyspace` | 0002 | Significant | M (arch-risk) | 1 | opus |
| 7 | `feat(store): brief store and slug` | 0002 | Standard | M | 6 | — |
| 8 | `feat(api): persist generated brief + dedup cache` | 0002 | Standard | M | 7, 4 | — |
| 9 | `feat(api): GET /api/briefs and /api/briefs/[slug]` | 0002 | Standard | S | 7 | haiku |
| 10 | `feat(web): brief permalink page from JSON` | 0003 | Standard | M | 9, 5 | haiku |
| 11 | `feat(web): gallery grid + submit flow wired to API` | 0003 | Standard | M | 9, 5 | — |
| 12 | `feat(migrate): parse existing briefs into seed JSON` | 0004 | Standard | L | 7, 2 | opus |
| 13 | `chore(migrate): retire per-book HTML and books-index.json` | 0004 | Standard | S | 12, 11, 10 | haiku |
| 14 | `feat(security): per-IP rate limiting + global spend cap` | 0005 | Significant | M (arch-risk) | 8, 6 | opus |
| 15 | `feat(security): input validation and caps on /api/generate` | 0005 | Standard | S | 4 | haiku |
| 16 | `docs(readme): usage, deploy, and env documentation` | — | Trivial | S | 14, 13 | haiku |

Full per-unit acceptance criteria, files-in-scope, and risks are carried verbatim into the Linear
issues. The authoritative source for execution is the spec referenced by each unit.

---

## Critical path

`1 → 2 → 3 → 4 → 5 → 10/11 → 13 → 16` (8 deep). Units 2 (schema/prompt) and 4 (endpoint) are the
tightest constraints — everything funnels through them.

## Parallelizable tracks (after Milestone 1 lands)

- **A — store/api:** 6 → 7 → {8, 9}
- **B — reading frontend:** 10, 11 (after 9 + 5)
- **C — migration:** 12 (after 7 + 2) → 13 (after 11 + 10)
- **D — security:** 15 (after 4, independent); 14 (after 8 + 6)

---

## Totals & top risks

- **Units:** 16 · **Specs:** 5 · **ADRs:** 3 · **Significant units:** 2, 6, 14

1. Model output quality/consistency + structured-output JSON-Schema limits (no `minItems`/`maxItems`
   server-side) — strict zod validation, prompt fixtures, later evals.
2. Latency vs Vercel timeout (Opus + adaptive thinking) — set `maxDuration`, stream + `.finalMessage()`.
3. Seed migration of 10 bespoke HTML pages — fixture-driven parser that flags unmapped sections.
4. KV keyspace is load-bearing — lock in ADR 0002, minimal `lib/kv.ts` surface.
5. Cost-cap correctness — the global daily cap must hard-block, not just throttle.
