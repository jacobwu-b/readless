# SOP: Manually generating a brief with your own LLM

> Use this when you want to generate a `Brief` yourself (e.g. paste into Claude/ChatGPT in a
> browser, or call a model outside this repo) instead of going through `POST /api/generate`, and
> land it in the repo as a seed via a normal PR.
>
> This bypasses `lib/generate.ts` — no automatic zod validation happens until step 4. Do not skip
> step 4.

## When to use this

- You want a brief for a book but don't want to spend an `/api/generate` call (e.g. testing,
  or the model output needs hand-editing before it's good enough).
- You're backfilling `data/seeds.json` with a curated brief the way the original 10 were written
  (see `docs/specs/0004-seed-migration.md`).

If you just want the product to generate a brief for a reader, use the site / `/api/generate`
instead — this SOP is for maintainers producing a seed.

## The prompt

Copy the **entire output** of this repo's prompt builder, not a paraphrase — it embeds the exact
section counts from `lib/schema.ts` (`COUNTS`) so your model's output validates. Get the live text
by running:

```bash
node --import tsx -e "import('./lib/prompt.ts').then(m => console.log(m.buildBriefPrompt('BOOK TITLE', 'AUTHOR')))"
```

Replace `BOOK TITLE` / `AUTHOR` (author is optional — drop the second arg to omit it). Paste the
printed prompt as-is into your own LLM's chat.

If you can't run the command, here is the prompt template it produces (current as of this SOP;
the command above is always the source of truth — schema counts can drift):

```
You are the editorial engine behind ReadLess, a premium product that turns a book into a
short, structured, intellectually serious brief. Produce a brief for "{TITLE}" [by {AUTHOR}].

Write as if for a product people pay a premium subscription to read. The insights must reflect
genuine depth — a reader should walk away understanding the book's real intellectual contribution,
not a surface summary. "Apply This" must be concrete enough to act on today. The reflection
questions should be the kind someone journals about for twenty minutes.

## Output contract

Return ONLY a single JSON object — no markdown, no code fences, no commentary before or after.
The object must have exactly these fields and nothing else:

- "slug": string. URL-safe kebab-case identifier for the book (e.g. "atomic-habits").
- "title": string. The book's title.
- "author": string. The author's name.
- "year": integer. Original publication year.
- "category": string. A short eyebrow category (e.g. "Psychology", "History").
- "tags": array of three to five short lowercase topic tags.
- "cover": string. "https://covers.openlibrary.org/b/isbn/{ISBN13}-L.jpg" using the book's
  ISBN-13, or "" if you cannot confirm the ISBN.
- "dateAdded": string. Today's date as "YYYY-MM-DD".
- "readTime": string. An honest read-time estimate for the brief, e.g. "9 min".
- "thesis": string. Two to three sentences stating the book's central argument with precision.
- "keyInsights": array of EXACTLY 5 items. Each item is an object
  { "title": string, "points": array of strings }. "title" is the insight in one sharp sentence;
  "points" are 2–4 tight clauses explaining why it matters and what it implies — not prose.
- "pullQuote": string. The single most memorable, quotable sentence from the book.
- "watchOutFor": array of 3–4 items, same { "title", "points" } shape. Cognitive traps, failure
  modes, or common misapplications.
- "comparison": OPTIONAL object { "label": string, "columns": array of strings,
  "rows": array of rows } comparing two contrasting concepts central to the book. Each row is an
  array of strings with exactly one cell per column (at least 2 columns and 2 rows). Omit this
  field entirely if the book has no clear binary or spectrum worth comparing.
- "applyThis": array of 3–5 items, same { "title", "points" } shape. Concrete, specific
  techniques — "here is the exact move", not "think more carefully".
- "reflectionQuestions": array of EXACTLY 4 strings. Questions that provoke genuine
  self-examination and connect the book's ideas to the reader's actual life.

Honor the counts exactly. Do not add fields that are not listed above.
```

## Step by step

1. **Branch.** From an up-to-date `main`:
   ```bash
   git checkout main && git pull origin main
   git checkout -b feat/seed-{book-slug}
   ```

2. **Generate the prompt and get the brief.**
   - Run the `node --import tsx` command above to get the exact prompt for your book.
   - Paste it into your own LLM. Take the raw JSON response — strip any code fences or commentary
     the model added even though the prompt told it not to.
   - Save it to a scratch file, e.g. `/tmp/brief.json` (not committed).

3. **Fill `dateAdded` and sanity-check `cover`.** Models are unreliable about "today's date" and
   ISBNs — set `dateAdded` to the actual date you're adding this, and spot-check the `cover` URL
   loads an image (or set it to `""` if you can't confirm the ISBN).

4. **Validate against the schema before touching the repo.** This is the step that stands in for
   `generateBrief`'s automatic validation — do not skip it:
   ```bash
   node --import tsx -e "
     import { BriefSchema } from './lib/schema.ts';
     import { readFileSync } from 'node:fs';
     const brief = JSON.parse(readFileSync('/tmp/brief.json', 'utf8'));
     BriefSchema.parse(brief);
     console.log('valid:', brief.slug);
   "
   ```
   Fix any zod errors by editing the JSON (or re-prompting your LLM with the specific error) and
   re-run until it passes. Common failures: wrong `keyInsights`/`reflectionQuestions` count, a
   `watchOutFor`/`applyThis` array outside its min/max, an extra field the model invented, or a
   `comparison` row with a mismatched cell count.

5. **Add it to `data/seeds.json`.** Insert the validated object into the array (alphabetical by
   `slug` isn't enforced, but keep it near similar entries for readability). Confirm the `slug` is
   unique in that file.

6. **Run the checks:**
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
   `npm test` includes the seeds guard tests (`data/seeds.json` shape, schema validity, slug
   uniqueness) — a malformed entry fails here, not in production.

7. **Manual verification.** Run `vercel dev` (or your usual dev loop) and load `brief.html?slug={slug}`
   to eyeball rendering — long insight titles, the comparison table, pull quote — before opening
   the PR.

8. **Open the PR.** Push the branch and open a PR against `main` using
   `.github/PULL_REQUEST_TEMPLATE.md`, filled in full. Notably:
   - **Spec:** link `docs/specs/0004-seed-migration.md` (or `0001-brief-generation.md` if this is
     a net-new curated brief rather than a migrated one).
   - **Tests:** "No new tests — this is a data addition covered by the existing seeds guard tests
     in `data/seeds.json.test.ts`" (adjust to the actual test file name).
   - **Manual steps:** note that the brief was generated by hand outside `/api/generate` and which
     LLM/model you used, so a reviewer knows it wasn't schema-validated by `generateBrief`.
   - **Out of scope:** anything you noticed but didn't fix (e.g. a stale cover elsewhere).

   ```bash
   git add data/seeds.json
   git commit -m "feat(seeds): add {Book Title} brief"
   git push -u origin feat/seed-{book-slug}
   gh pr create --fill
   ```

9. **Wait for CI green, then merge is confirmed by a maintainer** — per `CLAUDE.md` §11, the task
   isn't done until the PR is merged, not just opened.

## Guardrails (from `CLAUDE.md`, still apply here)

- No secrets in the JSON, commit messages, or PR body — your LLM API key never belongs in this repo.
- No AI attribution in commit messages or the PR.
- Don't hand-edit `lib/schema.ts` or `lib/prompt.ts` counts to make a bad brief pass — fix the
  brief, or stop and raise it as a spec question if the schema itself feels wrong for this book.
- If the model output requires reshaping the schema (e.g. a book genuinely has no `comparison`,
  which is already optional — fine), that's normal. If it requires a *new* field or shape, stop:
  that's a schema change and needs the architectural-risk process in `CLAUDE.md` §3, not a
  one-off seed PR.
