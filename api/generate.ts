import type { VercelRequest, VercelResponse } from "@vercel/node";

import { generateBrief } from "../lib/generate";
import { logger } from "../lib/logger";

/** The boundary `handler` calls. Injectable so tests mock generation cleanly. */
type GenerateBrief = (title: string, author?: string) => Promise<unknown>;

/** Reads `req.body`, tolerating the raw-string case Vercel may hand us. */
function parseBody(body: unknown): Record<string, unknown> | undefined {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (body && typeof body === "object") {
    return body as Record<string, unknown>;
  }
  return undefined;
}

/**
 * `POST /api/generate` — thin handler over `generateBrief`.
 *
 * Validates the body shape, returns the Brief on success, and maps the outcomes to
 * status codes: 405 for non-POST, 400 for a missing/blank title, 502 when generation
 * fails. Persistence and input caps are out of scope (see specs 0002 / 0005).
 *
 * `generate` is injectable so the model boundary can be mocked in tests; Vercel only
 * ever invokes the handler with `(req, res)`.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  generate: GenerateBrief = generateBrief
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = parseBody(req.body);
  const title = body?.["title"];
  if (typeof title !== "string" || title.trim() === "") {
    res.status(400).json({ error: "A non-empty 'title' is required" });
    return;
  }

  const rawAuthor = body?.["author"];
  const author = typeof rawAuthor === "string" && rawAuthor.trim() !== "" ? rawAuthor : undefined;

  try {
    const brief = await generate(title, author);
    res.status(200).json(brief);
  } catch (error) {
    logger.error(
      "brief generation failed",
      error instanceof Error ? error : undefined,
      { title }
    );
    res.status(502).json({ error: "Brief generation failed" });
  }
}
