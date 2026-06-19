import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getCachedSlug, setCachedSlug } from "../lib/cache";
import { generateBrief } from "../lib/generate";
import type { KVClient } from "../lib/kv";
import { logger } from "../lib/logger";
import type { Brief } from "../lib/schema";
import { getBrief, saveBrief } from "../lib/store";

/** The boundary `handler` calls. Injectable so tests mock generation cleanly. */
type GenerateBrief = (title: string, author?: string) => Promise<Brief>;

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
 * `POST /api/generate` — generate a brief, persist it, and dedup repeats.
 *
 * Validates the body shape, then short-circuits on a repeat: a normalized
 * (title|author) request that has already been generated returns the stored brief
 * without calling the model (spec 0002). Otherwise it generates, persists the brief
 * under its slug, caches the request → slug mapping, and returns the brief.
 *
 * Outcomes map to status codes: 405 for non-POST, 400 for a missing/blank title,
 * 502 when generation fails. Concurrent identical requests may both generate once
 * (stampede) — accepted under the no-abuse assumption (spec 0002, Open questions).
 *
 * `generate`, `client`, and `seeds` are injectable so the model and both store
 * boundaries can be mocked in tests; Vercel only ever invokes the handler with
 * `(req, res)`, leaving the seed catalog to default to the committed seeds.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  generate: GenerateBrief = generateBrief,
  client?: KVClient,
  seeds?: Brief[]
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

  // Dedup: a cached request returns its stored brief without paying the model.
  // A dangling cache entry (slug with no brief) falls through to regeneration.
  const cachedSlug = await getCachedSlug(title, author, client);
  if (cachedSlug) {
    const cached = await getBrief(cachedSlug, client, seeds);
    if (cached) {
      res.status(200).json(cached);
      return;
    }
  }

  try {
    const brief = await generate(title, author);
    await saveBrief(brief, client);
    await setCachedSlug(title, author, brief.slug, client);
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
