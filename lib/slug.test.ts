import { test } from "node:test";
import assert from "node:assert";

import { slugify } from "./slug";

test("slugify is deterministic — the same title yields the same slug", () => {
  assert.strictEqual(slugify("Thinking, Fast and Slow"), slugify("Thinking, Fast and Slow"));
  assert.strictEqual(slugify("Thinking, Fast and Slow"), "thinking-fast-and-slow");
});

test("slugify lowercases, drops punctuation, and hyphenates whitespace", () => {
  assert.strictEqual(slugify("Atomic Habits!"), "atomic-habits");
  assert.strictEqual(slugify("  The Reason for God  "), "the-reason-for-god");
  assert.strictEqual(slugify("Cue, Craving — Response & Reward"), "cue-craving-response-reward");
});

test("slugify strips diacritics down to ASCII", () => {
  assert.strictEqual(slugify("Café Société"), "cafe-societe");
});

test("slugify disambiguates a collision by appending a numeric suffix", () => {
  assert.strictEqual(slugify("Atomic Habits", ["atomic-habits"]), "atomic-habits-2");
});

test("slugify skips suffixes that are already taken", () => {
  const taken = ["atomic-habits", "atomic-habits-2", "atomic-habits-3"];
  assert.strictEqual(slugify("Atomic Habits", taken), "atomic-habits-4");
});

test("slugify returns the base slug when no collision exists", () => {
  assert.strictEqual(slugify("Sapiens", ["atomic-habits", "deep-work"]), "sapiens");
});

test("slugify falls back to a default for a title with no slug-able characters", () => {
  assert.strictEqual(slugify("!@#$ %^&*"), "brief");
  assert.strictEqual(slugify("!@#$ %^&*", ["brief"]), "brief-2");
});
