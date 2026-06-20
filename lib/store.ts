import seedData from "../data/seeds.json" with { type: "json" };

import {
  keys,
  get,
  set,
  addToIndex,
  listIndex,
  indexSlugs,
  type KVClient,
} from "./kv.js";
import type { Brief } from "./schema.js";
import { slugify } from "./slug.js";

/**
 * The brief store: save/get/list built on the `lib/kv.ts` keyspace (ADR-0002),
 * merged at read time with static seeds. KV is authoritative — a stored brief
 * always wins over a seed with the same slug. The store is the only thing that
 * knows about the seed/KV merge; the keyspace stays in `lib/kv.ts`.
 *
 * `client` and `seeds` are injectable so tests can drive both boundaries in
 * memory. An omitted `client` forwards to the `lib/kv.ts` helpers' own default —
 * the real `@upstash/redis`-backed client — so the store never names the datastore.
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

/**
 * Persist a brief under its slug and register its gallery projection.
 *
 * Two writes, both owned here: the full Brief under `brief:{slug}` (read by permalinks),
 * and its lightweight `IndexEntry` into the `briefs:gallery` hash (read by the gallery in
 * one call, ADR-0005). The gallery index is derived state — keeping it correct depends on
 * every brief flowing through this function.
 */
export async function saveBrief(brief: Brief, client?: KVClient): Promise<void> {
  await set(keys.brief(brief.slug), brief, client);
  await addToIndex(brief.slug, toIndexEntry(brief), client);
}

/**
 * Persist a freshly generated brief under a server-owned, collision-free slug.
 *
 * The model's `slug` is a hint we discard: the slug is the brief's load-bearing
 * public address (`brief:{slug}`, `/{slug}`), so the store derives it from the
 * title and disambiguates against every slug already taken — the KV index ∪ the
 * static seeds — via `slugify`. This guarantees a new generation can never
 * overwrite an existing brief or shadow a curated seed; a colliding title gets the
 * next free `-{n}` suffix instead. Returns the stored brief with its final slug so
 * the caller can address and cache it.
 */
export async function createBrief(
  brief: Brief,
  client?: KVClient,
  seeds: Brief[] = defaultSeeds
): Promise<Brief> {
  const taken = new Set([...(await indexSlugs(client)), ...seeds.map((seed) => seed.slug)]);
  const stored: Brief = { ...brief, slug: slugify(brief.title, taken) };
  await saveBrief(stored, client);
  return stored;
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
 *
 * One `HGETALL` of the pre-projected `briefs:gallery` hash (ADR-0005) — no per-slug
 * full-brief fetches, so the gallery read is O(1) KV round-trips regardless of corpus size.
 */
export async function listBriefs(
  client?: KVClient,
  seeds: Brief[] = defaultSeeds
): Promise<IndexEntry[]> {
  const stored = await listIndex<IndexEntry>(client);

  const bySlug = new Map<string, IndexEntry>();
  for (const seed of seeds) bySlug.set(seed.slug, toIndexEntry(seed));
  for (const [slug, entry] of Object.entries(stored)) bySlug.set(slug, entry); // KV wins

  return [...bySlug.values()];
}
