#!/bin/sh
# Block writes that contain content matching obvious secret patterns.
#
# This is a coarse net — gitleaks (via CI) is the precise one. The point of
# this hook is to fail loudly *before* the secret enters the working tree, not
# to be exhaustive.

set -eu

input="$(cat)"

# Extract the content being written. We check both the file_path and the
# new_string / content fields. Patterns are intentionally simple — false
# positives are recoverable, false negatives aren't.
content="$(printf '%s' "$input" | tr -d '\n')"

block() {
  printf 'Blocked by pre-tool-use-block-secrets: %s\n' "$1" 1>&2
  printf 'Move secrets to an env var, document the var in .env.example, and read it via the config layer.\n' 1>&2
  exit 2
}

# AWS access keys
echo "$content" | grep -Eq 'AKIA[0-9A-Z]{16}' && block "looks like an AWS access key"

# Generic API keys / tokens — heuristic: long high-entropy strings adjacent to
# obvious key/token names. Trips on hex secrets and base64 tokens.
echo "$content" | grep -Eiq '(api[_-]?key|secret|password|token|bearer)["'"'"' ]*[:=][ ]*["'"'"'][A-Za-z0-9_/+=-]{24,}' && \
  block "looks like a hardcoded credential"

# Private keys
echo "$content" | grep -Eq -- '-----BEGIN ((RSA|EC|OPENSSH|DSA|PGP) )?PRIVATE KEY' && \
  block "private key material"

# Slack / GitHub / Stripe tokens (cheap to check, common to leak)
echo "$content" | grep -Eq 'xox[baprs]-[A-Za-z0-9-]{10,}' && block "Slack token"
echo "$content" | grep -Eq 'gh[pousr]_[A-Za-z0-9]{36,}' && block "GitHub token"
echo "$content" | grep -Eq '(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}' && block "Stripe key"

exit 0
