#!/bin/sh
# When the agent attempts to stop, nudge it back into the loop if there are
# uncommitted changes and tests haven't been run recently.
#
# This hook does NOT run tests itself — that's the agent's job and the CI's
# job. It only checks for the *signal* that a green run was achieved
# (presence of a recent test artefact) and surfaces a reminder otherwise.
#
# Customize TEST_ARTIFACT below to a path your test runner writes on success
# (e.g. coverage report, .pytest_cache, etc.).

set -eu

# Skip the check if there's nothing to commit
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

TEST_ARTIFACT=".test-passed"  # touch this from your test runner on green
MAX_AGE_SECONDS=600           # 10 minutes

if [ ! -f "$TEST_ARTIFACT" ]; then
  cat 1>&2 <<EOF
stop-verify-tests: there are uncommitted changes and no record of a green test run.
Per CLAUDE.md §11: tests passing is part of the Definition of Done.
Run the test suite, then continue. If this is intentional, override and explain.
EOF
  exit 2
fi

# Check artifact age (POSIX-friendly)
now="$(date +%s)"
mtime="$(stat -c %Y "$TEST_ARTIFACT" 2>/dev/null || stat -f %m "$TEST_ARTIFACT" 2>/dev/null || echo 0)"
age=$((now - mtime))

if [ "$age" -gt "$MAX_AGE_SECONDS" ]; then
  printf 'stop-verify-tests: last green test run was %ss ago (>%ss). Re-run tests.\n' "$age" "$MAX_AGE_SECONDS" 1>&2
  exit 2
fi

exit 0
