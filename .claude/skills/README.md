# Skills

On-demand domain workflows. Each skill is a folder with a `SKILL.md`. Skills
are loaded by the agent only when relevant — they don't bloat the global
context budget the way `CLAUDE.md` does.

## When to add a skill

Add one when **all** of the following are true:

- The workflow is repeated.
- It's domain-specific (DB migrations, payment flows, deploy procedures, etc.).
- Putting it in `CLAUDE.md` would push that file past ~50 lines.
- The trigger conditions can be described precisely.

## When NOT to add a skill

- The workflow happens once. Just do it.
- The trigger is vague ("when working on the frontend"). Vague triggers cause
  uniform context decay across all instructions — the brief's central warning.
- It's a slash command or shortcut. We don't have a custom-command kingdom
  here; intent is typed, not memorized.

## Structure

```
.claude/skills/
  _TEMPLATE/
    SKILL.md           # template for new skills
  <skill-name>/
    SKILL.md           # required — the workflow
    [other files]      # optional — examples, scripts, fixtures
```

## Authoring rules

1. The `SKILL.md` description determines when the skill loads. Be precise. The
   description is the only thing the agent sees before deciding to load it.
2. Skills should be short. If yours is over ~100 lines, it's probably two skills.
3. Reference, don't reproduce. Link to specs and ADRs rather than restating them.
4. Review skills quarterly. Delete ones that haven't fired in 90 days.
