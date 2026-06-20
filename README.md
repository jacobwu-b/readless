# ReadLess

ReadLess turns books into short, structured, AI-generated briefs and serves them as a fast static reading site backed by serverless functions.

## How it works

ReadLess is a static frontend (HTML/CSS/vanilla JS) over a handful of Vercel Functions. Briefs are generated with the Anthropic API, validated with `zod`, and persisted in Vercel KV. A committed seed catalog (`data/seeds.json`) ships briefs that exist before anyone generates one.

**Browse.** The gallery (`index.html`) calls `GET /api/briefs` for a lightweight index — every brief as metadata, KV briefs merged with seeds. Opening one routes to `brief.html?slug=…` (the pretty URL `/books/:slug` rewrites to it), which calls `GET /api/briefs/:slug` for the full brief: KV first, then a seed, else 404.

**Generate.** The submit form (`generate.html`) posts `{ title, author? }` to `POST /api/generate`. The handler:

1. Rejects non-`POST` (405) and oversized bodies (413).
2. Validates and trims the title/author, rejecting bad input (400).
3. Enforces abuse controls (429 with `Retry-After`) — a per-IP daily throttle and a global daily spend cap.
4. Dedups: a normalized `(title|author)` that was generated before returns the stored brief without calling the model.
5. Otherwise generates the brief, persists it under its slug, caches the request → slug mapping, and returns it (502 if generation fails).

The KV keyspace is owned solely by `lib/kv.ts`: `brief:{slug}`, the `briefs:index` set, `cache:{key}` dedup entries, and the `rl:*` rate-limit counters.

## Quick start

```bash
# install
npm install

# configure (see Environment below)
cp .env.example .env        # then fill in ANTHROPIC_API_KEY
vercel env pull             # populates the KV_* vars for a linked project

# run — Vercel dev server: serves the static site and the api/ functions
npm run dev

# checks
npm test                    # node --test across **/*.test.ts
npm run typecheck           # tsc --noEmit
npm run build               # vercel build
```

`npm run dev` starts `vercel dev` on http://localhost:3000. Generating a brief makes real Anthropic API calls (and spends), so a valid `ANTHROPIC_API_KEY` is required; browsing the seeded gallery works without one. The rate-limit and dedup counters live in KV, so the generate flow needs the `KV_*` vars populated.

To regenerate the seed catalog from the source briefs, run `npm run build:seeds`.

## Environment

All env vars are read through `lib/env.ts` and nowhere else. Every var the app reads is listed in [`.env.example`](./.env.example) — copy it to `.env` for local dev. New var → update `.env.example` in the same PR. Never commit real secrets.

| Var | Required | Default | What it's for |
|---|---|---|---|
| `NODE_ENV` | no | `development` | Standard Node environment flag. |
| `ANTHROPIC_API_KEY` | **yes** | — | Auth for the Anthropic API (brief generation). Server-side only. |
| `KV_REST_API_URL` | yes for KV | — | Vercel KV REST endpoint. Required to read/write briefs. |
| `KV_REST_API_TOKEN` | yes for KV | — | Vercel KV read/write token. |
| `KV_REST_API_READ_ONLY_TOKEN` | no | — | Vercel KV read-only token. |
| `KV_URL` | no | — | Vercel KV connection string (provided by Vercel). |
| `RATE_LIMIT_IP_PER_DAY` | no | `20` | Per-IP daily generation cap. Positive integer; falls back if unset/invalid. |
| `RATE_LIMIT_GLOBAL_PER_DAY` | no | `100` | Global daily generation cap — the spend backstop. Positive integer; falls back if unset/invalid. |

The `KV_*` vars are populated automatically by `vercel env pull` for a linked project, or copied from the KV store's **`.env.local`** tab in the Vercel dashboard.

## Vercel KV setup

1. In the Vercel dashboard, open **Storage → Create Database → KV** and attach it to the project.
2. Run `vercel link` to link the local checkout, then `vercel env pull` to write the `KV_*` vars into `.env`.
3. Add `ANTHROPIC_API_KEY` in the project's **Settings → Environment Variables** (and in your local `.env`).

The KV store starts empty; the gallery is populated from `data/seeds.json` until briefs are generated. Function settings (max durations, the `/books/:slug` rewrite, and the env allowlist) live in [`vercel.json`](./vercel.json).

## Deploy

Deploys are handled by Vercel. Connect the repo and pushes to `main` ship to production; pull requests get preview deployments. Ensure `ANTHROPIC_API_KEY` and the `KV_*` vars are set for the Production environment before the first generate call. `npm run build` (`vercel build`) reproduces the build locally.

## Working in this repo

This repo is built for human + AI collaboration. The operating model is documented in [`CLAUDE.md`](./CLAUDE.md). Read it before contributing — humans included.

- **Specs** live in [`docs/specs/`](./docs/specs/). Features start there, not in code.
- **Architectural decisions** live in [`docs/decisions/`](./docs/decisions/) as ADRs.
- **PR protocol** is in `CLAUDE.md` §5. Squash-merge to main only.
- **Repository GitHub settings** are documented in [`.github/repo-settings.md`](./.github/repo-settings.md).

## Stack

- TypeScript / Vercel Functions (Node) / Vercel KV / Vercel hosting — with the Anthropic API for brief generation and `zod` for validation.

## License

Copyright (c) 2026 Zhengyuan Wu. All Rights Reserved.

This product is protected by copyright and distributed under licenses restricting copying, distribution, and decompilation. See [`LICENSE`](./LICENSE) for full terms.
