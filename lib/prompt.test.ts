import { test } from "node:test";
import assert from "node:assert";

import { buildBriefPrompt } from "./prompt";
import { COUNTS } from "./schema";

test("buildBriefPrompt is deterministic for the same inputs", () => {
  const a = buildBriefPrompt("Atomic Habits", "James Clear");
  const b = buildBriefPrompt("Atomic Habits", "James Clear");
  assert.strictEqual(a, b);
});

test("buildBriefPrompt embeds every schema section name in the contract", () => {
  const prompt = buildBriefPrompt("Thinking, Fast and Slow", "Daniel Kahneman");
  for (const field of [
    "thesis",
    "keyInsights",
    "pullQuote",
    "watchOutFor",
    "comparison",
    "applyThis",
    "reflectionQuestions",
  ]) {
    assert.ok(prompt.includes(field), `prompt should mention "${field}"`);
  }
});

test("buildBriefPrompt embeds the section counts from the schema", () => {
  const prompt = buildBriefPrompt("Sapiens", "Yuval Noah Harari");
  assert.ok(
    prompt.includes(String(COUNTS.keyInsights)),
    "prompt should state the key-insight count"
  );
  assert.ok(
    prompt.includes(String(COUNTS.reflectionQuestions)),
    "prompt should state the reflection-question count"
  );
  assert.ok(
    prompt.includes(String(COUNTS.applyThisMin)) &&
      prompt.includes(String(COUNTS.applyThisMax)),
    "prompt should state the apply-this range"
  );
});

test("buildBriefPrompt interpolates the title and author", () => {
  const prompt = buildBriefPrompt("Atomic Habits", "James Clear");
  assert.ok(prompt.includes("Atomic Habits"));
  assert.ok(prompt.includes("James Clear"));
});

test("buildBriefPrompt omits author cleanly when not provided", () => {
  const prompt = buildBriefPrompt("Atomic Habits");
  assert.ok(prompt.includes("Atomic Habits"));
  assert.ok(!prompt.includes("undefined"), "no leaked undefined author");
  assert.ok(!/\bby\s+["']/.test(prompt), "no dangling 'by' clause when author is absent");
});

test("buildBriefPrompt instructs JSON-only output", () => {
  const prompt = buildBriefPrompt("Atomic Habits", "James Clear");
  assert.ok(/json/i.test(prompt), "prompt should require JSON output");
});
