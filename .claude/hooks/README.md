# Hooks

Deterministic guardrails that run on Claude Code tool events. `CLAUDE.md` is
advisory — agents can (and do) skip instructions in long sessions. Hooks run
unconditionally.

## Wiring

Hooks are wired in `.claude/settings.json` (project-scoped, committed) or
`~/.claude/settings.json` (per-user, not committed). This template ships
`.claude/settings.json` configured to use the scripts in this directory.

## Hooks in this template

| Hook | When | What it does |
|---|---|---|
| `pre-tool-use-block-dangerous.sh` | `PreToolUse` on `Bash` | Blocks irreversible commands (rm -rf, force-push, drop database, etc.) |
| `pre-tool-use-block-secrets.sh` | `PreToolUse` on `Edit`/`Write` | Refuses to write content matching obvious secret patterns |
| `post-tool-use-format.sh` | `PostToolUse` on `Edit`/`Write` | Auto-formats edited files (delegates to your stack's formatter) |
| `stop-verify-tests.sh` | `Stop` | Reminds the agent if tests aren't green before declaring done |

## Authoring rules

- Hooks must exit 0 to allow the action; non-zero to block.
- Hooks should be fast. They run on every tool call.
- Hooks should be deterministic. Don't call out to LLMs from a hook.
- Hooks should fail closed on dangerous operations, fail open on cosmetic ones.

## Tested platforms

Linux and macOS. The scripts use POSIX sh; portability is a feature.
