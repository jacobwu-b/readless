# Evals

The regression suite for the AI agent. Each task in `tasks/` captures a real
failure mode — a moment where the agent (or a prompt, or a CLAUDE.md
instruction) produced wrong output.

## When to add an eval

Every embarrassing output becomes a permanent eval task. From the brief:

> Drawn from real failures. Convert every embarrassing prod incident into a
> permanent eval task.

You don't need hundreds. Aim for ≥20 in the first 90 days; add one per
incident thereafter.

## Structure

```
evals/
  README.md
  tasks/
    _TEMPLATE.md
    NNNN-short-slug.md
  runner/             # your eval harness (stack-specific)
```

## Gating

Once `tasks/` has ≥20 tasks, flip the `evals` job in `.github/workflows/ci.yml`
from `if: false` to `if: true`. PRs that regress evals don't merge.

## Authoring rules

- Each task is concrete and reproducible.
- Each task has an unambiguous pass/fail criterion. "Looks better" is not a
  criterion. "Output contains X and does not contain Y" is.
- LLM-as-judge is acceptable for taste/style tasks if you provide a rubric
  and pin the judge model.
- Keep tasks under 100 lines each. If yours is longer, it's two tasks.
