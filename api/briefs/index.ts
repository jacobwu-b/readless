import type { VercelRequest, VercelResponse } from "@vercel/node";

import type { KVClient } from "../../lib/kv.js";
import type { Brief } from "../../lib/schema.js";
import { listBriefs } from "../../lib/store.js";

/**
 * `GET /api/briefs` — the gallery index: every brief as a lightweight entry
 * (metadata, no editorial sections), seeds merged with KV briefs (spec 0002).
 *
 * `client` and `seeds` are injectable so both store boundaries can be driven in
 * tests; Vercel only ever invokes the handler with `(req, res)`, leaving the
 * store to default to the real KV client and the committed seed catalog.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  client?: KVClient,
  seeds?: Brief[]
): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const entries = await listBriefs(client, seeds);
  res.status(200).json(entries);
}
