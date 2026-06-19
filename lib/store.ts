import seedData from "../data/seeds.json" with { type: "json" };

import { keys, get, set, addToIndex, list, type KVClient } from "./kv";
import type { Brief } from "./schema";

/**
 * The brief store: save/get/list built on the `lib/kv.ts` keyspace (ADR-0002),
 * merged at read time with static seeds. KV is authoritative — a stored brief
 * always wins over a seed with the same slug. The store is the only thing that
 * knows about the seed/KV merge; the keyspace stays in `lib/kv.ts`.
 *
 * `client` and `seeds` are injectable so tests can drive both boundaries in
 * memory. An omitted `client` forwards to the `lib/kv.ts` helpers' own default —
 * the real `@vercel/kv`-backed client — so the store never names the datastore.
 */

/** The committed static seeds — curated briefs not (yet) written to KV. */
const defaultSeeds = seedData as Brief[];

/** A lightweight brief projection for the gallery: metadata, no editorial sections. */
export interface IndexEntry {
  slug: string;
  title: string;
  author: string;
  year: number;
  category: string;
  tags: string[];
  cover: string;
  dateAdded: string;
  readTime: string;
}

/** Project a full Brief down to its gallery index entry. */
function toIndexEntry(brief: Brief): IndexEntry {
  return {
    slug: brief.slug,
    title: brief.title,
    author: brief.author,
    year: brief.year,
    category: brief.category,
    tags: brief.tags,
    cover: brief.cover,
    dateAdded: brief.dateAdded,
    readTime: brief.readTime,
  };
}

/** Persist a brief under its slug and register it in the gallery index. */
export async function saveBrief(brief: Brief, client?: KVClient): Promise<void> {
  await set(keys.brief(brief.slug), brief, client);
  await addToIndex(brief.slug, client);
}

/**
 * Fetch a full brief by slug. KV first; on a miss, fall back to a static seed;
 * returns null when neither has the slug.
 */
export async function getBrief(
  slug: string,
  client?: KVClient,
  seeds: Brief[] = defaultSeeds
): Promise<Brief | null> {
  const stored = await get<Brief>(keys.brief(slug), client);
  if (stored) return stored;
  return seeds.find((seed) => seed.slug === slug) ?? null;
}

/**
 * List every brief as a lightweight index entry: seeds merged with KV briefs,
 * de-duplicated by slug with KV winning on collision.
 */
export async function listBriefs(
  client?: KVClient,
  seeds: Brief[] = defaultSeeds
): Promise<IndexEntry[]> {
  const slugs = await list(client);
  const stored = await Promise.all(slugs.map((slug) => get<Brief>(keys.brief(slug), client)));

  const bySlug = new Map<string, IndexEntry>();
  for (const seed of seeds) bySlug.set(seed.slug, toIndexEntry(seed));
  for (const brief of stored) if (brief) bySlug.set(brief.slug, toIndexEntry(brief)); // KV wins

  return [...bySlug.values()];
}
