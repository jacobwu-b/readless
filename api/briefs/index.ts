import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../../lib/kv";
import { listBriefs } from "../../lib/store";

/**
 * `GET /api/briefs` — the gallery index: every brief as a lightweight entry
 * (metadata, no editorial sections), seeds merged with KV briefs (spec 0002).
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

  const entries = await listBriefs(client);
  res.status(200).json(entries);
}
