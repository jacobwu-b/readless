#!/usr/bin/env bash
# Apply the repository settings documented in .github/repo-settings.md to the
# current GitHub repo. Idempotent — safe to re-run.
#
# Requires: gh CLI authenticated, repo already created on GitHub.
#
# Usage:
#   ./scripts/bootstrap-repo-settings.sh
#
# This script handles the API-only settings. Branch protection rulesets that
# the API doesn't expose cleanly should still be configured via the UI per
# .github/repo-settings.md.

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh not authenticated. Run: gh auth login" >&2
  exit 1
fi

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Configuring $REPO"

# --- Repository general settings ---
gh api -X PATCH "repos/$REPO" \
  -f default_branch=main \
  -F has_wiki=false \
  -F has_discussions=false \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F allow_auto_merge=true \
  -F delete_branch_on_merge=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  >/dev/null
echo "  ✓ general settings"

# --- Vulnerability alerts + automated security fixes ---
gh api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null
gh api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null
echo "  ✓ Dependabot alerts + security updates"

# --- Secret scanning + push protection ---
gh api -X PATCH "repos/$REPO" \
  -F security_and_analysis[secret_scanning][status]=enabled \
  -F security_and_analysis[secret_scanning_push_protection][status]=enabled \
  >/dev/null || echo "  ! secret scanning requires GHAS on private repos"
echo "  ✓ secret scanning"

# --- Branch protection on main ---
# This sets the core protection. Some advanced settings (signed commits,
# linear history) require Rulesets — see .github/repo-settings.md.
gh api -X PUT "repos/$REPO/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF' >/dev/null
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lint", "Types", "Test", "Build", "Secret scan"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
echo "  ✓ branch protection on main"

# --- Default labels ---
# Mirrors .github/settings.yml. Idempotent via gh label create --force.
declare -A LABELS=(
  [bug]="d73a4a:Broken behavior"
  [tech-debt]="fbca04:Out-of-scope cleanup or fragility surfaced during work"
  [feature]="0e8a16:New capability or behavior change"
  [spec-needed]="5319e7:Cannot start until a spec exists in docs/specs/"
  [blocked]="b60205:Cannot proceed; needs a decision or external action"
)
for name in "${!LABELS[@]}"; do
  IFS=":" read -r color desc <<< "${LABELS[$name]}"
  gh label create "$name" --color "$color" --description "$desc" --force >/dev/null
done
echo "  ✓ labels"

echo
echo "Done. Manual follow-ups (UI required):"
echo "  - Require signed commits on main (Settings → Rules → New ruleset)"
echo "  - Restrict who can push tags matching v*.*.*"
echo "  - Configure Actions allowed list"
echo "  - Enable private vulnerability reporting (Settings → Security)"
echo
echo "Audit quarterly. See .github/repo-settings.md."
