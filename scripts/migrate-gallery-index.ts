import { fileURLToPath } from "node:url";

import { logger } from "../lib/logger";
import type { KVClient } from "../lib/kv";
import { backfillGalleryIndex } from "../lib/store";

/**
 * One-shot migration to ADR-0005: backfill the `briefs:gallery` hash from the legacy
 * `briefs:index` set ∪ `brief:{slug}` so the gallery's O(1) read is correct for briefs
 * generated before the cutover. The backfill logic lives in `lib/store.ts` (and is unit
 * tested there); this script is the thin CLI wrapper. Idempotent — safe to re-run.
 *
 * `client` is injectable for tests; production defaults to the real KV client. Run once
 * against production after deploy: `npx tsx scripts/migrate-gallery-index.ts`.
 */
export async function migrate(client?: KVClient): Promise<number> {
  const count = await backfillGalleryIndex(client);
  logger.info("gallery index backfill complete", { count });
  return count;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((error) => {
    logger.error("gallery index backfill failed", error as Error);
    process.exitCode = 1;
  });
}
