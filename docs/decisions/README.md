# Architecture Decision Records (ADRs)

One file per architectural decision. Each ADR is a snapshot of *why* we made a
choice — the alternatives, the constraints, the consequences. Future
contributors (human or agent) read these to avoid relitigating settled
questions.

## When to file an ADR

- New architectural patterns (state management, data access, deployment)
- Technology choices (database, queue, framework)
- Cross-cutting policies (auth, error handling, logging)
- Anything where "we chose X over Y" matters in 6 months

Don't file an ADR for one-file refactors, naming choices, or anything that
fits comfortably in a spec.

## Authoring

Use [`_TEMPLATE.md`](./_TEMPLATE.md). Filename: `NNNN-short-slug.md`.
Sequence numbers monotonically increase — never reuse a deleted number.

## Lifecycle

- **Proposed** — drafted, under discussion.
- **Accepted** — decided, in force.
- **Superseded** — overridden by a later ADR. Link forward; don't delete.

## Anti-patterns

- Treating ADRs as design docs. ADRs are decision records — concise.
  Designs go elsewhere.
- Editing accepted ADRs to reflect new thinking. File a new ADR that
  supersedes the old one. The history is the point.
