# ReadLess

ReadLess turns books into short, structured, AI-generated briefs and serves them as a fast static reading site backed by serverless functions.

## Quick start

```bash
# install
npm install

# run (Vercel dev server — serves the site and the api/ functions)
npm run dev

# test
npm test
```

Briefs are generated with the Anthropic API and stored in Vercel KV. Copy `.env.example` to `.env` and fill in the required keys (`vercel env pull` populates the KV variables for a linked project).

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
