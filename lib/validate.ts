import { z } from "zod";

/**
 * Input validation for `POST /api/generate` (spec 0005). Rejects empty, oversized, or
 * malformed titles/authors — and an oversized request body — before any model call, so
 * obviously-bad input never reaches the paid boundary.
 *
 * Bounds are deliberately generous (a 200-char title, 120-char author) so real books
 * with long subtitles pass; only the clearly-malformed is turned away. Header-derived
 * size limits are out of scope — the cap here measures the parsed body itself.
 */

/** Max accepted request body, in bytes. A title+author payload is well under this. */
export const MAX_BODY_BYTES = 4096;

/** Trimmed-length bounds (spec 0005 acceptance criteria). */
export const TITLE_MIN = 1;
export const TITLE_MAX = 200;
export const AUTHOR_MAX = 120;

/** C0 control characters and DEL — never legitimate inside a title or author. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const noControlChars = (s: string) => !CONTROL_CHARS.test(s);

/** A string trimmed of surrounding whitespace before any length/content checks. */
const trimmed = z.string().transform((s) => s.trim());

const title = trimmed.pipe(
  z
    .string()
    .min(TITLE_MIN, `title must be ${TITLE_MIN}-${TITLE_MAX} characters`)
    .max(TITLE_MAX, `title must be ${TITLE_MIN}-${TITLE_MAX} characters`)
    .refine(noControlChars, "title must not contain control characters")
);

const author = trimmed
  .pipe(
    z
      .string()
      .max(AUTHOR_MAX, `author must be at most ${AUTHOR_MAX} characters`)
      .refine(noControlChars, "author must not contain control characters")
  )
  // A blank or whitespace-only author is treated as absent, matching the store's
  // optional-author contract.
  .transform((s) => (s === "" ? undefined : s))
  .optional();

/** The accepted body shape: a required title and an optional author. */
export const GenerateInputSchema = z.object({ title, author });

export type GenerateInput = z.infer<typeof GenerateInputSchema>;

/** A validated request, or the first human-readable reason it was rejected. */
export type ValidationResult =
  | { ok: true; value: GenerateInput }
  | { ok: false; error: string };

/** Validate and normalize a parsed request body against {@link GenerateInputSchema}. */
export function validateGenerateInput(body: unknown): ValidationResult {
  const parsed = GenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request body",
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Whether a raw request body exceeds {@link MAX_BODY_BYTES}. Measures the body as
 * received — a still-unparsed string, or the re-serialized object Vercel handed us —
 * so the cap holds regardless of how the body arrived. A missing body is never oversize.
 */
export function bodyTooLarge(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES;
}
