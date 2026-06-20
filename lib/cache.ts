import { keys, get, set, type KVClient } from "./kv.js";

/**
 * Request dedup: maps a normalized (title|author) request to the slug of an
 * already-generated brief, so a repeat short-circuits before the model is called
 * (spec 0002, ADR-0002). This module owns the normalization that turns a request
 * into a `cache:{key}` lookup; the keyspace itself lives in `lib/kv.ts`.
 *
 * `client` is injectable so tests drive an in-memory store; an omitted client
 * forwards to the `lib/kv.ts` default — the real `@vercel/kv`-backed client.
 */

/** Lowercase, trim, and collapse internal whitespace runs to a single space. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The dedup key for a request: normalized title and author joined by `|`. Case,
 * surrounding and internal whitespace, and a missing author are all normalized so
 * editorially identical requests collide on the same key.
 */
export function cacheKey(title: string, author?: string): string {
  return `${normalize(title)}|${normalize(author ?? "")}`;
}

/** The slug previously cached for this request, or null if it was never generated. */
export async function getCachedSlug(
  title: string,
  author?: string,
  client?: KVClient
): Promise<string | null> {
  return get<string>(keys.cache(cacheKey(title, author)), client);
}

/** Map this request to a generated brief's slug so future repeats dedup to it. */
export async function setCachedSlug(
  title: string,
  author: string | undefined,
  slug: string,
  client?: KVClient
): Promise<void> {
  await set(keys.cache(cacheKey(title, author)), slug, client);
}
