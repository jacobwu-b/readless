import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { BriefSchema, type Brief } from "../lib/schema";

/**
 * Guards the committed seed catalog: the one-shot migration that produced it has
 * been retired (issue #25), so this test is the standing contract that
 * `data/seeds.json` stays a complete, schema-valid set of 10 unique briefs.
 */
test("the committed seeds.json holds 10 schema-valid briefs with unique slugs", () => {
  const path = fileURLToPath(new URL("./seeds.json", import.meta.url));
  const seeds = JSON.parse(readFileSync(path, "utf8")) as unknown[];

  assert.strictEqual(seeds.length, 10, "seeds.json must contain all 10 migrated briefs");

  const slugs = new Set<string>();
  for (const seed of seeds) {
    const brief: Brief = BriefSchema.parse(seed);
    slugs.add(brief.slug);
  }
  assert.strictEqual(slugs.size, 10, "every seed slug must be unique");
});
