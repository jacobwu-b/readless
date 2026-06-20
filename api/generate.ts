import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getCachedSlug, setCachedSlug } from "../lib/cache";
import { generateBrief } from "../lib/generate";
import type { CounterClient, KVClient } from "../lib/kv";
import { logger } from "../lib/logger";
import { clientIp, enforceRateLimit } from "../lib/ratelimit";
import type { Brief } from "../lib/schema";
import { getBrief, createBrief } from "../lib/store";
import { bodyTooLarge, validateGenerateInput } from "../lib/validate";

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
 * Outcomes map to status codes: 405 for non-POST, 413 for an oversized body, 400 for
 * a title/author that fails validation (spec 0005), 429 (with `Retry-After`) when the
 * per-IP or global daily limit is hit (spec 0005), 502 when generation fails. The body
 * is size-capped and validated before any model call. Concurrent identical requests may
 * both generate once (stampede) — accepted under the no-abuse assumption (spec 0002).
 *
 * `generate`, `client`, and `seeds` are injectable so the model and both store
 * boundaries can be mocked in tests; Vercel only ever invokes the handler with
 * `(req, res)`, leaving the seed catalog to default to the committed seeds.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  generate: GenerateBrief = generateBrief,
  client?: KVClient & CounterClient,
  seeds?: Brief[]
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Reject an oversized body before parsing or touching the model (spec 0005).
  if (bodyTooLarge(req.body)) {
    res.status(413).json({ error: "Request body too large" });
    return;
  }

  // Validate length, trim, and reject control chars before any model call (spec 0005).
  const input = validateGenerateInput(parseBody(req.body));
  if (!input.ok) {
    res.status(400).json({ error: input.error });
    return;
  }
  const { title, author } = input.value;

  // Abuse controls (spec 0005): throttle per IP and hard-block on the global daily
  // spend cap before any model call. Spoofable IPs are accepted under no-abuse.
  const limit = await enforceRateLimit(clientIp(req), { client });
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    const error =
      limit.reason === "global"
        ? "Daily generation limit reached. Please try again tomorrow."
        : "Too many requests. Please try again later.";
    res.status(429).json({ error });
    return;
  }

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
    // The store owns the slug: it derives a collision-free one and may suffix it,
    // so cache and respond with the persisted brief, not the model's raw output.
    const stored = await createBrief(brief, client, seeds);
    await setCachedSlug(title, author, stored.slug, client);
    res.status(200).json(stored);
  } catch (error) {
    logger.error(
      "brief generation failed",
      error instanceof Error ? error : undefined,
      { title }
    );
    res.status(502).json({ error: "Brief generation failed" });
  }
}
