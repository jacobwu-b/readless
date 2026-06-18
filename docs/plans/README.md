# Plans

Per-branch implementation plans for Xl work and any change that trips the
architectural-risk flag, plus decomposition plans that break work too big
for one PR into sized children. Drafted before code. Reviewed. Approved.
Then implemented.

## When to file

- **Always** for Xl work and architectural-risk changes (schema, dependency,
  contract, new pattern, irreversible — see `CLAUDE.md` §3), and to decompose
  work too big for one PR.
- **Optional** for M and L work — useful when handing off between
  contributors or running multiple agents in parallel.
- **Never** for Xs/S work — overhead.

## Authoring

Use [`_TEMPLATE.md`](./_TEMPLATE.md). Filename: same as the branch
(`feat-payments-refunds.md`). One plan per branch.

## Lifecycle

Plans are short-lived. Once the PR merges, the plan is archival — keep it
for traceability but don't update it. New work gets a new plan on a new
branch.

## Why this exists

The brief: *"Forces commitment before tokens."* A written plan is the
cheapest place to catch a bad approach. It's also the cleanest delegation
contract — give the plan to an agent and the implementation is bounded.
