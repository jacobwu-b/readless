# ADR-0004: Bump @anthropic-ai/sdk to use adaptive thinking on Opus 4.8

> Status: accepted
> Date: 2026-06-17
> Deciders: @jacobwu-b

## Context

`J-101` pinned `@anthropic-ai/sdk` at `^0.70.0`. `J-102` builds `generateBrief`, which the spec
(`0001-brief-generation`) says calls **Claude Opus 4.8**, streamed for headroom, and validates the
result against the `Brief` schema. The repo's own `claude-api` skill and `CLAUDE.md` ("default to the
latest and most capable models") favour **adaptive thinking** for non-trivial generation, and brief
generation is genuinely editorial reasoning.

The installed SDK (`0.70.1`) cannot express this in a type-safe way: its `ThinkingConfigParam` is only
`enabled | disabled`, with no `adaptive` variant and no `output_config`/`effort`. On Opus 4.8,
`thinking: {type: "enabled", budget_tokens: N}` returns a 400 at runtime, so the old types map only
to options that either 400 or disable thinking. Per `CLAUDE.md` §6 a dependency version bump requires
approval and trips the architectural-risk flag, hence this ADR.

## Decision

We will bump `@anthropic-ai/sdk` from `^0.70.0` to `^0.104.2` (current latest), and `generateBrief`
will stream the request with `thinking: {type: "adaptive"}` against `claude-opus-4-8`.

We will **not** adopt strict structured outputs (`output_config.format`). Brief output stays
prompt-driven JSON that we `JSON.parse` and then validate with the `Brief` zod schema. This keeps
zod as the single contract (ADR-0001) and preserves the spec's required "model returned invalid JSON"
failure path, which strict structured outputs would erase.

## Consequences

**Positive**
- Adaptive thinking is available and type-checked, matching the spec's Opus 4.8 intent and the repo's
  model-usage guidance.
- The SDK types now match the live Messages API surface (adaptive thinking, current stop reasons).

**Negative**
- Larger dependency surface and lockfile churn; 34 minor releases of behavioural drift to absorb in
  one bump. Mitigated by the SDK being the official, first-party Anthropic client (~24M weekly
  downloads, last published 2026-06-15) and by the build/typecheck/test gates.
- Downstream `J-103` (the API handler) inherits the newer SDK.

**Neutral**
- Still a `0.x` SDK; future bumps remain architectural-risk events.

## Alternatives considered

### A: Stay on 0.70 and omit `thinking`

Omitting the parameter is valid on Opus 4.8 (it runs without thinking) and needs no dependency change.
Rejected by decision: it forgoes adaptive-thinking depth on editorial generation, against the repo's
stated model-usage preferences.

### B: Bump and use strict structured outputs (`output_config.format`)

Guarantees schema-conformant JSON. Rejected: it removes the "invalid JSON" failure mode the spec's
acceptance criteria require, and duplicates the zod contract that ADR-0001 makes canonical.

## References

- Spec `0001-brief-generation`, ADR-0001, `CLAUDE.md` §6, the `claude-api` skill.
