# Abuse controls

> Status: approved
> Owner: @jacobwu-b
> Last updated: 2026-06-17

## Problem

`POST /api/generate` calls a paid model on every request. With no auth and a public endpoint, a
single careless or looping client could run up real cost, even absent malicious intent. The product
explicitly assumes no malicious actors but still wants a cheap, low-complexity safety envelope so
spend is bounded and obviously-bad input is rejected before it reaches the model.

## Goals

- Per-IP rate limiting on generation, with clear `429` + `Retry-After` responses when exceeded.
- A global daily cap that hard-blocks generation once reached, bounding worst-case spend.
- Input validation that rejects empty, oversized, or malformed titles/authors before the model call.
- The whole envelope stays simple and runs on the existing KV layer — no new dependencies.

## Non-goals

- Authentication, accounts, or API keys for callers.
- Defeating a determined attacker (IP spoofing via headers is accepted).
- Per-user quotas or billing.

## Users / actors

- An anonymous visitor hitting `POST /api/generate`; the global cap protects the shared instance.

## Acceptance criteria

- [ ] A request under the per-IP limit is allowed.
- [ ] A request over the per-IP limit returns `429` with a `Retry-After` header.
- [ ] Generation is blocked once the global daily cap is reached.
- [ ] Rate-limit counters key per IP per day and expire.
- [ ] A title shorter than 1 or longer than 200 chars is rejected with `400`.
- [ ] An author longer than 120 chars is rejected with `400`.
- [ ] Control characters in input are rejected, and an oversize request body is rejected.

## Approach

`lib/ratelimit.ts` implements a per-IP token bucket and a global daily counter on KV counters with
TTLs (see ADR `0003-rate-limiting`), invoked at the top of `api/generate.ts`. `lib/validate.ts`
holds the zod input schema (length bounds, trimming, control-char rejection) and a body-size cap.
Limits are configured via env vars surfaced in `.env.example` and read through `lib/env.ts`.

## Out of scope

- CAPTCHA or proof-of-work.
- Distinguishing real users behind a shared NAT.

## Open questions

- Concrete default limits (per-IP/min, global/day) — pick conservative defaults in the ADR; tunable
  via env without code change.

## Risks

- Over-restrictive validation rejects legitimate titles → generous bounds + tests on realistic input.
- Counter TTL/clock correctness → tests with a mocked clock and KV.
- The global cap is the real spend backstop and must hard-block, not merely throttle.

## References

- ADR `0003-rate-limiting`, `CLAUDE.md` §6 (data-access + config invariants), spec `0001`.
