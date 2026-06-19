/**
 * Deterministic, collision-safe slug generation for briefs.
 *
 * Slugs are the public, load-bearing address of a brief (`brief:{slug}` in KV,
 * `/{slug}` in the URL — ADR-0002), so the same title must always produce the same
 * base slug. Disambiguation is the caller's concern: pass the slugs already taken
 * (e.g. the KV index) and a numeric suffix is appended when the base collides. This
 * keeps `slug.ts` a pure leaf utility with no I/O — the store orchestrates it.
 */

/** Fallback slug for a title whose characters all strip away (e.g. punctuation only). */
const FALLBACK = "brief";

/** Unicode combining marks left behind by NFKD decomposition of accented letters. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/** Lowercase ASCII slug: diacritics stripped, runs of non-alphanumerics hyphenated. */
function baseSlug(text: string): string {
  const slug = text
    .normalize("NFKD") // split accented letters into base + combining mark
    .replace(COMBINING_MARKS, "") // drop the marks, leaving ASCII
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics becomes one hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
  return slug || FALLBACK;
}

/**
 * Turns a title into a slug, disambiguating against `taken`.
 *
 * Returns the base slug when it is free; otherwise appends the lowest `-{n}` (n ≥ 2)
 * not already in `taken`. Deterministic for a given `(text, taken)` pair.
 */
export function slugify(text: string, taken: Iterable<string> = []): string {
  const base = baseSlug(text);
  const used = new Set(taken);
  if (!used.has(base)) return base;

  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
