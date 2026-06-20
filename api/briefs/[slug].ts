import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../../lib/kv.js";
import { getBrief } from "../../lib/store.js";

/**
 * `GET /api/briefs/[slug]` — the full brief for a single slug: KV first, then a
 * static seed, else 404 (spec 0002). Vercel supplies the slug as `req.query.slug`.
 *
 * `client` is injectable so the KV boundary can be mocked in tests; Vercel only
 * ever invokes the handler with `(req, res)`.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  client?: KVClient
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const raw = req.query?.["slug"];
  const slug = Array.isArray(raw) ? raw[0] : raw;
  if (typeof slug !== "string" || slug.trim() === "") {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  const brief = await getBrief(slug, client);
  if (!brief) {
    res.status(404).json({ error: "Brief not found" });
    return;
  }

  res.status(200).json(brief);
}
