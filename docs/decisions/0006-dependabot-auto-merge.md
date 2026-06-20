# ADR-0006: Dependabot minor/patch updates auto-merge on green CI

> Status: accepted
> Date: 2026-06-19
> Deciders: @jacobwu-b

## Context

`.github/workflows/dependabot-auto-merge.yml` enables auto-merge for every
`semver-minor`/`semver-patch` Dependabot PR once the required status checks pass.
No human review click is required; the test suite is the only merge gate. Major
bumps are excluded — they are labeled `dependencies:major` and held for the
monthly reconciliation (`dependabot-reconciliation.yml`).

This was flagged as contradicting `CLAUDE.md` §6, which reads "new deps and
version bumps require approval … last publish" (issue #24, P1). The §6 wording
predates the auto-merge workflow and was written for the case it actually
governs: a human (or agent) *adding* a dependency or deliberately changing a
version. It does not distinguish that act from the steady stream of upstream
minor/patch bumps Dependabot raises, so the two read as in conflict.

The risk the issue raises is real but bounded for this project: a compromised
upstream patch could reach `main`, and from there a preview/production deploy,
without a human in the loop. ReadLess is a single-maintainer, non-production
brief store. The realistic worst case from a bad minor/patch is a build break
(caught by CI) or, in the tail, leaking generated book summaries or crashing the
site — not loss of user data or money. Reverting every minor/patch to manual
approval would impose a standing review tax on the maintainer that is not
justified by that blast radius, and unattended-but-tested updates are the entire
point of running Dependabot here.

The workflow and the invariant must agree. Either the workflow conforms to §6
(manual approval) or §6 is amended to bless the workflow. We choose the latter.

## Decision

We will keep Dependabot auto-merge for `semver-minor` and `semver-patch` updates,
gated on green required checks, and we will amend `CLAUDE.md` §6 so the stated
invariant matches the workflow.

- §6's approval requirement (name, version, justification, weekly downloads, last
  publish) governs **adding a new dependency or a manual/major version change** —
  the deliberate human act it was written for.
- **Dependabot `semver-minor`/`semver-patch` PRs are exempt** from the manual
  approval click: CI (lint, types, tests, build) is their merge gate, and they
  auto-merge on green per this ADR.
- **Major bumps stay manual**, held for monthly reconciliation with changelog
  review, unchanged from current behavior.

This records auto-merge as intentional policy, not drift, and resolves the
workflow ↔ §6 conflict in #24.

## Consequences

**Positive**
- The stated invariant (§6) and the enforced behavior (the workflow) agree; the
  #24 conflict is closed.
- No standing manual-review tax on routine, test-passing minor/patch updates.
- Security posture is now a recorded, revisitable decision rather than an
  unexamined default.

**Negative**
- A malicious or backdoored upstream minor/patch that passes CI can reach `main`
  unattended. Tests do not detect exfiltration, post-install scripts, or
  backdoors. Accepted given the blast radius above; revisit if user accounts,
  secrets of value, or a real production tier land.
- §6 is now more nuanced (a carve-out), so it must be read carefully — the
  approval gate is no longer "all version bumps."

**Neutral**
- Adding provenance / supply-chain gating (npm `--audit`, OSV/Socket) before
  auto-merge remains available as a future hardening step without revisiting
  this decision; it would tighten the gate, not change the policy.

## Alternatives considered

### A: Revert minor/patch to manual approval (conform the workflow to §6)

Make every Dependabot PR wait for a human click. Strictly safer against upstream
compromise, but imposes a continuous review burden disproportionate to a
single-maintainer, non-production project, and defeats the reason Dependabot is
configured to group and raise these at all. Rejected as paranoid for this blast
radius.

### B: Add a supply-chain gate (audit/OSV/Socket) as a required check before auto-merge

Keep auto-merge but require a provenance/vulnerability scan to pass first. A
reasonable middle ground that raises the bar without reintroducing manual
review. Deferred, not rejected: it is additive hardening (see Neutral) and not
needed to resolve the §6 conflict, which is the actual bug in #24.

### C: Restrict auto-merge to devDependencies / patch-only

Hold prod-dep minors for review, auto-merge the rest. Partially reduces exposure
but reintroduces a manual queue for exactly the dependencies (`@anthropic-ai/sdk`,
`@vercel/kv`, `zod`) most likely to ship frequent minors, for marginal benefit at
this blast radius. Rejected.

## References

- Issue #24 (P1 security), `.github/workflows/dependabot-auto-merge.yml`,
  `.github/workflows/dependabot-reconciliation.yml`, `.github/repo-settings.md`,
  `CLAUDE.md` §6.
