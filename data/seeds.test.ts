import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BriefSchema, type Brief } from "../lib/schema";

/**
 * Guards the committed seed catalog: the one-shot migration that produced it has
 * been retired (issue #25), so this test is the standing contract that
 * `data/seeds.json` stays a complete, schema-valid set of unique briefs.
 */
test("the committed seeds.json holds 11 schema-valid briefs with unique slugs", () => {
  const path = fileURLToPath(new URL("./seeds.json", import.meta.url));
  const seeds = JSON.parse(readFileSync(path, "utf8")) as unknown[];

  assert.strictEqual(seeds.length, 11, "seeds.json must contain all 11 committed briefs");

  const slugs = new Set<string>();
  for (const seed of seeds) {
    const brief: Brief = BriefSchema.parse(seed);
    slugs.add(brief.slug);
  }
  assert.strictEqual(slugs.size, 11, "every seed slug must be unique");
});
