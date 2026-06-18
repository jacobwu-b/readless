---
name: [skill-name]
description: [One sentence — when this skill should fire. Be precise. The agent reads only this line before deciding whether to load the skill, so vague descriptions cause the skill to either never trigger or fire on irrelevant work. Good: "Use when adding or modifying a database migration in db/migrations/." Bad: "Use for database stuff."]
---

# [Skill name]

## When to use

Restate the trigger condition. If the agent has loaded this skill but the
trigger doesn't match the task, the skill's first instruction should be:
"this is not the right skill — exit."

## Context

What the agent needs to know to do this work that isn't in `CLAUDE.md`. Keep
this minimal. If it belongs in `CLAUDE.md`, put it there.

## Workflow

Numbered steps. Concrete commands where possible. Reference fixtures or
examples in this skill folder rather than reproducing them.

1.
2.
3.

## Failure modes

Specific things that go wrong here, and how to avoid them. This is the
landmines section for this skill.

-

## References

- Specs: `docs/specs/...`
- ADRs: `docs/decisions/...`
