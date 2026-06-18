import { z } from "zod";

/**
 * Section-count bounds enforced by the Brief schema.
 *
 * These are the single source of truth for "how many of each section" — the zod
 * schema below reads from them, and `lib/prompt.ts` interpolates them into the
 * generation prompt, so the schema and the prompt cannot drift on the numbers.
 *
 * Bounds are a superset of the editorial ranges in `book-summary-prompt.md` and the
 * existing curated corpus: exact where prompt and corpus agree (insights, reflection
 * questions), widened where the corpus is looser (apply-this minimum) so existing
 * briefs migrate without editorial changes. See ADR-0001 and the spec's Risks.
 */
export const COUNTS = {
  keyInsights: 5,
  reflectionQuestions: 4,
  watchOutForMin: 3,
  watchOutForMax: 4,
  applyThisMin: 3,
  applyThisMax: 5,
  comparisonMinColumns: 2,
  comparisonMinRows: 2,
} as const;

const nonEmpty = z.string().min(1);

/** A two-level bullet: a bold title line plus its supporting sub-points. */
const BulletItemSchema = z
  .object({
    title: nonEmpty,
    points: z.array(nonEmpty).min(1),
  })
  .strict();

/** An optional concept-comparison table: header columns plus equal-width rows. */
const ComparisonSchema = z
  .object({
    label: nonEmpty,
    columns: z.array(nonEmpty).min(COUNTS.comparisonMinColumns),
    rows: z.array(z.array(nonEmpty)).min(COUNTS.comparisonMinRows),
  })
  .strict()
  .refine(
    (c) => c.rows.every((row) => row.length === c.columns.length),
    "every comparison row must have one cell per column"
  );

/**
 * The canonical Brief record: the single contract for brief shape across generation,
 * store, API, and frontend. Strict — unknown fields are rejected (ADR-0001).
 */
export const BriefSchema = z
  .object({
    // Metadata
    slug: nonEmpty,
    title: nonEmpty,
    author: nonEmpty,
    year: z.number().int(),
    category: nonEmpty,
    tags: z.array(nonEmpty).min(1),
    cover: z.string(),
    dateAdded: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateAdded must be YYYY-MM-DD"),
    readTime: nonEmpty,

    // Editorial sections
    thesis: nonEmpty,
    keyInsights: z.array(BulletItemSchema).length(COUNTS.keyInsights),
    pullQuote: nonEmpty,
    watchOutFor: z
      .array(BulletItemSchema)
      .min(COUNTS.watchOutForMin)
      .max(COUNTS.watchOutForMax),
    comparison: ComparisonSchema.optional(),
    applyThis: z
      .array(BulletItemSchema)
      .min(COUNTS.applyThisMin)
      .max(COUNTS.applyThisMax),
    reflectionQuestions: z.array(nonEmpty).length(COUNTS.reflectionQuestions),
  })
  .strict();

export type Brief = z.infer<typeof BriefSchema>;
export type BulletItem = z.infer<typeof BulletItemSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;
