# Specs

The source of truth for features. Code is generated against these — they are
not after-the-fact documentation.

## When you need a spec

- **Always** for M, L, and Xl work (see `CLAUDE.md` §3).
- **Sometimes** for Xs/S work — when the change touches a behavior the spec
  describes, update the spec in the same PR.

## Authoring

Use [`_TEMPLATE.md`](./_TEMPLATE.md). One spec per feature. Filename:
`NNNN-short-slug.md` where NNNN is a zero-padded sequence.

Specs are durable. They outlive any agent session, model swap, or chat. Treat
them like API contracts — versioned, reviewed, deliberate.

## Lifecycle

1. **Draft** — author writes it. Adversarial review for ambiguity. Open
   questions surfaced, not papered over.
2. **Approved** — at least one reviewer (and the spec's owner) sign off.
   Ready for implementation.
3. **Shipped** — feature is live. Spec is archived alongside its PR.
4. **Superseded** — when a new spec replaces an old one, link forward.

## Anti-patterns

- Specs that describe implementation. The spec says *what*; plans and ADRs
  say *how*.
- Specs written after the fact. If you find yourself reverse-engineering a
  spec from existing code, the code lacks one — write it forward, not back.
- Specs that are 12 pages long. If yours is, you're describing five features.
