# GitHub Repository Settings

These settings are part of the contract. They enforce in GitHub what
`CLAUDE.md` enforces in process. Apply them to every new repo from this template.

GitHub does not load most of these from a file in the repo. Apply them via the
UI, the `gh` CLI, the REST API, or — ideally — the
[Probot Settings app](https://github.com/apps/settings) using
`.github/settings.yml` (provided alongside this doc).

If you change a setting, update this file in the same PR.

---

## General

| Setting | Value | Why |
|---|---|---|
| Default branch | `main` | Single trunk. |
| Wikis | Off | `docs/` is the wiki. |
| Issues | On | We file out-of-scope work as issues. |
| Projects | On | Optional, but useful. |
| Discussions | Off until needed | Avoid scattering decisions. |
| Allow forking | Off (private repos) | Reduces leak surface. |
| Sponsorships | Off | N/A for product repos. |

## Pull requests

| Setting | Value | Why |
|---|---|---|
| Allow merge commits | **Off** | `CLAUDE.md` §5 — squash only. |
| Allow squash merging | **On** | The only merge style. |
| Allow rebase merging | **Off** | Rewrites history; breaks the "born from main" invariant. |
| Default commit title for squash | "Pull request title" | PR title is the squash commit. |
| Default commit message for squash | "Pull request title and description" | Keeps context in history. |
| Always suggest updating PR branches | **On** | Surfaces drift before merge. |
| Allow auto-merge | **On** | Required for Dependabot auto-merge and for agents to auto-merge once checks pass + reviews approve. |
| Automatically delete head branches | **On** | No stale branches. |
| Merge queue (on `main`) | **On** | Serializes + rebases queued PRs so each merges against fresh `main` — kills the manual rebase loop under bursts of Dependabot PRs. |

## Branch protection — `main`

`main` is governed by a **Ruleset** (Settings → Rules → Rulesets), not the legacy
branch-protection block in `.github/settings.yml`. The switch is required because
two features of the Dependabot automation — a per-actor **review bypass for
Dependabot** and a **merge queue** — cannot be expressed in legacy protection.

The ruleset must enforce, **for everyone except the documented bypass**:

- **Require a pull request before merging**
  - Require approvals: **1** (raise to 2 once team > 5)
  - Dismiss stale approvals on new commits: **On**
  - Require review from Code Owners: **On**
  - Require approval of the most recent reviewable push: **On**
  - **Bypass list: Dependabot only.** Lets Dependabot minor/patch PRs merge
    unattended. Every human PR still needs review. The bypass is for *review
    only* — status checks below are NOT bypassed, so the test gate still gates
    Dependabot.
- **Require status checks to pass**
  - Require branches to be up to date before merging: **On**
  - Required checks (must match job names in `.github/workflows/ci.yml`):
    - `Lint`
    - `Types`
    - `Test`
    - `Build`
    - `Secret scan`
    - `Evals` *(once enabled — see CI workflow comment)*
    - `Analyze` *(CodeQL)*
- **Require merge queue**: **On** (rebase + test each PR against fresh `main`,
  merge in order). The CI workflow has a `merge_group:` trigger so the checks
  run for queued merges.
- **Require conversation resolution before merging**: **On**
- **Require signed commits**: **On** (raise this bar early; it's painful to add later)
- **Require linear history**: **On** (squash-only enforces this; belt + suspenders)
- **Block force pushes** and **Restrict deletions**: **On**
- **Restrict who can push to matching branches**: nobody
- Enforcement: **Active**, applies to admins (no org/admin bypass beyond the
  Dependabot review bypass above).

> Note: on a single-maintainer repo, "Require approvals: 1" + "Require review
> from Code Owners" means human PRs cannot self-approve. Relax these two if you
> need solo self-merge, or add a second reviewer before tightening them. The
> Dependabot bypass does not affect human PRs.

### Applying it (ordered — avoids an unprotected window)

Rulesets and merge queue are not reliably managed by the Probot Settings app, so
apply them out-of-band. **Do the ruleset first, retire legacy protection last.**
Replace `<owner>/<repo>` with the repo slug.

1. **Create the protection ruleset.** Easiest in the UI (Settings → Rules →
   Rulesets → New branch ruleset), targeting `main`, with the rules above. Add
   **Dependabot** to the bypass list (Bypass list → Add → Dependabot), and add a
   **Merge queue** rule. The equivalent API entry point is
   `POST /repos/{owner}/{repo}/rulesets` (`gh api`), but the Dependabot bypass
   actor and merge-queue rule are fiddly to hand-author as JSON — prefer the UI,
   then verify with:

   ```sh
   gh api repos/<owner>/<repo>/rulesets --jq '.[].name'
   ```

2. **Confirm repo-level settings** that the ruleset depends on (already in
   `settings.yml`, but verify they applied):

   ```sh
   gh api repos/<owner>/<repo> \
     --jq '{auto_merge: .allow_auto_merge, delete_branch: .delete_branch_on_merge}'
   # expect: allow_auto_merge true, delete_branch_on_merge true
   ```

3. **Retire the legacy branch protection** only after the ruleset is active and
   verified, so `main` is never unprotected:

   ```sh
   gh api -X DELETE repos/<owner>/<repo>/branches/main/protection
   ```

   The `branches:` block has already been removed from `.github/settings.yml`, so
   the Probot app will not re-create it.

## Actions

| Setting | Value | Why |
|---|---|---|
| Actions permissions | "Allow [org] actions and reusable workflows" + selected third-party | Least privilege. |
| Allowed third-party actions | Pinned to SHA in workflows | Supply-chain hygiene. |
| Workflow permissions (default `GITHUB_TOKEN`) | **Read repository contents and packages permissions** | Per-job scope where needed. |
| Allow GitHub Actions to create and approve PRs | **Off** | Humans approve. |
| Fork PR workflows | "Require approval for first-time contributors" | Stops drive-by token theft. |

## Secrets and security

- **Secret scanning**: On
- **Push protection** (blocks pushes that contain secrets): **On**
- **Dependabot alerts**: On
- **Dependabot security updates**: On
- **Code scanning** (CodeQL — see `.github/workflows/codeql.yml`): On
- **Private vulnerability reporting**: On (so `SECURITY.md` link works)

## Access

- **Default permission for org members**: Read (raise per-team via teams, not org-wide)
- **Outside collaborators**: avoid; prefer adding contractors to a scoped team
- **Two-factor authentication**: required at the org level (verify in org settings)

## Tags and releases

- **Tag protection rule**: protect `v*.*.*` patterns from deletion and force-update
- **Releases**: drafted by humans; generated notes are fine, edit before publish

---

## Applying these settings

### Option 1 — Probot Settings app (recommended)

Install the [Settings app](https://github.com/apps/settings) on the org. The
sibling file `.github/settings.yml` will be applied on every push to `main`.
Note: it covers most but not all of the above (rulesets and some security
settings still need the API or UI).

### Option 2 — `gh` CLI script

See `scripts/bootstrap-repo-settings.sh` for a script that applies the
settings above via the GitHub REST API. Run once per new repo.

### Option 3 — UI

Walk this document top-to-bottom in the repo's Settings tab. Last resort —
prone to drift.

---

## Audit

Quarterly: diff this file against the live settings. Any drift is either a
bug in the settings (update them) or a bug in this file (update the file).
Don't let them disagree silently.
