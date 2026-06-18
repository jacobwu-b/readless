#!/bin/sh
# Auto-format files after they're edited.
#
# Brief, Pillar 5: "Auto-format and lint after every edit. Last 10% no agent
# ever does."
#
# This script delegates to a project-level `make format-file FILE=<path>`
# target so that the formatting tooling stays in one place (the Makefile or
# task runner of your choice). If you don't have a Makefile, swap the call
# below for your stack's formatter.
#
# Fails open: if formatting itself fails, we don't block the agent — we just
# log the failure. The CI lint job is the hard gate.

set -eu

input="$(cat)"
file_path="$(printf '%s' "$input" | sed -n 's/.*"file_path":[[:space:]]*"\([^"]*\)".*/\1/p')"

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

# Skip non-source files
case "$file_path" in
  *.md|*.txt|*.lock|*.json|*.yml|*.yaml) ;;
  *.png|*.jpg|*.gif|*.pdf|*.zip) exit 0 ;;
esac

# Prefer a project-level format target if it exists.
if command -v make >/dev/null 2>&1 && grep -q '^format-file:' Makefile 2>/dev/null; then
  make format-file FILE="$file_path" >/dev/null 2>&1 || \
    printf 'post-tool-use-format: format-file failed for %s (non-blocking)\n' "$file_path" 1>&2
  exit 0
fi

# Fallback per-extension formatters. Adjust to your stack.
case "$file_path" in
  *.py)
    command -v ruff >/dev/null 2>&1 && ruff format "$file_path" >/dev/null 2>&1 || true
    ;;
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    command -v prettier >/dev/null 2>&1 && prettier --write --log-level error "$file_path" >/dev/null 2>&1 || true
    ;;
  *.go)
    command -v gofmt >/dev/null 2>&1 && gofmt -w "$file_path" || true
    ;;
  *.rs)
    command -v rustfmt >/dev/null 2>&1 && rustfmt --quiet "$file_path" || true
    ;;
esac

exit 0
