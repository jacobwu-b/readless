# Issue Sizing

Every issue carries a **size** alongside its priority. The title reads `[Px][Size] title` —
for example `[P0][M] Fix duplicate-record detection`. Priority says *how much it matters*;
size says *how much it costs to fix*. Together they let us pick the right issue for the time
we have: a free afternoon takes an `[S]`, a slow week takes an `[Xl]`.

Size is an **effort estimate**, not a measure of importance. A typo can be `[P0][Xs]`; a
nice-to-have refactor can be `[P3][L]`.

## Sizes are PR-sized

All five sizes describe **one pull request** — Xs through Xl span the range a single reviewable
PR can plausibly take, from a one-line fix to a whole subsystem slice. That is the upper bound:
**if the work can't land as one reviewable PR, it has no size.** Don't reach for a "bigger than
Xl" — decompose it first (a decomposition plan in [`docs/plans/`](plans/)), then size each child
Xs–Xl. Decomposition is a step that precedes sizing, not a size itself.

## How to size (repeatable methodology)

Size by the dominant signal, not the average. Walk the table top to bottom and stop at the
**first row whose triggers match** — the largest matching size wins.

| Size | Effort (focused) | Files | Objective triggers |
|------|------------------|-------|--------------------|
| **Xs** | minutes | 1 | Typo, comment, rename, formatting, one-line fix. No behavior change. |
| **S**  | up to ½ day | 1–3 | Isolated change, obvious approach. Small test add or edit. |
| **M**  | ~1 day | a few | A real feature or fix needing some design judgment. New tests required. |
| **L**  | 2–3 days | many | Many files or multiple domains, but still one coherent PR. New tests required. |
| **Xl** | several days | many | A whole subsystem slice — the largest a single reviewable PR should be. |

The size drives how the work runs (`CLAUDE.md` §3): Xs and S proceed directly, M and L run the
plan → Spec/TDD loop, and Xl adds a discuss-first and a saved plan. Sizing an issue therefore
also sizes the process it will take to close.

### Architectural risk is orthogonal to size

Some changes are risky out of proportion to their effort. A change that alters a persistent
schema, adds or bumps a dependency, changes a public contract, introduces a new architectural
pattern, or is otherwise irreversible **requires an ADR and a discuss-first — at any size.** Size
still estimates the effort honestly (a one-file schema migration is `S`); the risk flag governs
the ceremony. The two are independent: note the flag in the justification when it fires (e.g.
"S, schema-flagged").

### Tie-breakers

- **Uncertainty rounds up.** If you can't see the approach, you don't yet know the size — pick the
  larger and note the unknown in the justification.
- **Size estimates the fix, not the investigation.** A one-line fix found after a day of debugging
  is still `Xs`–`S`; file the debugging as its own issue if it was substantial.

## Recording the size

Each issue template has a **Size** dropdown and a **Size justification** field. Set the dropdown,
then write one short phrase pointing at the trigger that decided it — e.g. "M: new feature, ~6
files" or "S, schema-flagged: one-field migration, needs an ADR." The justification is what makes
the estimate auditable and the methodology repeatable: anyone re-reading should be able to confirm
the size from the phrase alone.

Finally, prefix the issue title with both tags: `[Px][Size] title`.
