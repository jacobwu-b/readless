#!/usr/bin/env bash
# Run this once after creating a new repo from this template.
#
# It does the following:
#   1. Reminds you of placeholders to fill in.
#   2. Initializes a fresh git history (squashes the template commits).
#   3. Optionally runs bootstrap-repo-settings.sh.

set -euo pipefail

cat <<'EOF'
Welcome.

Before continuing, fill in placeholders in:
  - CLAUDE.md           §1 (project context)
  - README.md           project name + stack
  - LICENSE             your chosen license
  - SECURITY.md         your security contact
  - .github/CODEOWNERS  your org/team handles
  - .env.example        your real env vars

Press enter when ready, or Ctrl-C to abort.
EOF
read -r _

# Squash template history so this repo starts clean
echo "Resetting git history..."
rm -rf .git
git init -b main
git add .
git commit -m "chore: initialize repository from template" --no-gpg-sign

cat <<'EOF'

Repository initialized.

Next:
  1. Create the repo on GitHub: gh repo create <name> --private --source=. --push
  2. Apply settings:             ./scripts/bootstrap-repo-settings.sh
  3. Read CLAUDE.md end-to-end   (yes, really)
  4. Write your first spec in    docs/specs/

EOF
