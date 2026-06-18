#!/bin/sh
# Block irreversible or repo-destructive Bash commands.
#
# Reads a JSON event from stdin (Claude Code hook contract). Exits non-zero
# to block the tool call and surface the message to the agent.
#
# Stack-agnostic. Add patterns specific to your stack as you discover them
# (e.g. production deploy commands, prod database URLs, etc.).

set -eu

input="$(cat)"
cmd="$(printf '%s' "$input" | sed -n 's/.*"command":[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "$cmd" ]; then
  exit 0
fi

block() {
  printf 'Blocked by pre-tool-use-block-dangerous: %s\n' "$1" 1>&2
  printf 'Command: %s\n' "$cmd" 1>&2
  printf 'If this is intentional, ask the human to run it directly.\n' 1>&2
  exit 2
}

case "$cmd" in
  # Force pushes and history rewrites
  *"git push"*"--force"*|*"git push"*"-f "*|*"git push -f"*) block "force-push to git" ;;
  *"git reset --hard"*) block "git reset --hard rewrites local history" ;;
  *"git filter-branch"*|*"git filter-repo"*) block "rewriting full history" ;;

  # Branch deletion of main / production branches
  *"git branch -D main"*|*"git branch -d main"*) block "deleting main branch" ;;
  *"git push"*":main"*|*"git push"*"origin main"*"--delete"*) block "deleting remote main" ;;

  # Direct commits / merges to main from CLI
  *"git checkout main"*"&&"*"git commit"*) block "committing directly to main" ;;
  *"git merge"*) block "manual git merge — squash-merge via PR only" ;;
  *"git rebase"*) block "manual git rebase — squash-merge via PR only" ;;

  # Filesystem destruction
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf \$HOME"*) block "rm -rf at filesystem root" ;;
  *"rm -rf .git"*) block "deleting .git directory" ;;
  *"rm -rf node_modules"*|*"rm -rf .venv"*) ;; # explicitly allowed
  *":(){ :|:& };:"*) block "fork bomb" ;;

  # Database destruction
  *"DROP DATABASE"*|*"drop database"*) block "DROP DATABASE" ;;
  *"TRUNCATE"*) block "TRUNCATE — confirm with the human first" ;;
  *"DELETE FROM"*"WHERE"*) ;; # bounded delete is fine
  *"DELETE FROM"*) block "unbounded DELETE — add a WHERE clause or confirm" ;;

  # Curl / wget piping to shell (supply chain risk)
  *"curl"*"| sh"*|*"curl"*"| bash"*|*"wget"*"| sh"*|*"wget"*"| bash"*)
    block "piping remote scripts to shell" ;;

  # Writing to .env (secret management lives elsewhere)
  *"> .env"*|*">> .env"*) block "writing to .env directly — update .env.example instead" ;;
esac

exit 0
