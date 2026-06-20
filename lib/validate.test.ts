import { test } from "node:test";
import assert from "node:assert";

import {
  AUTHOR_MAX,
  MAX_BODY_BYTES,
  TITLE_MAX,
  bodyTooLarge,
  validateGenerateInput,
} from "./validate.js";

/** A control character built at runtime so the source carries no raw control bytes. */
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

test("validateGenerateInput accepts a realistic title and author", () => {
  const result = validateGenerateInput({
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
  });

  assert.deepStrictEqual(result, {
    ok: true,
    value: { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
  });
});

test("validateGenerateInput accepts a long subtitle at the title bound", () => {
  // A real book with a long subtitle must not be rejected (spec 0005 Risks). Pad a
  // realistic prefix out to exactly the bound to prove the upper edge is inclusive.
  const prefix = "Sapiens: A Brief History of Humankind — ";
  const longTitle = prefix + "and Other Stories ".repeat(20);
  const title = longTitle.slice(0, TITLE_MAX);
  assert.strictEqual(title.length, TITLE_MAX);

  const result = validateGenerateInput({ title });
  assert.strictEqual(result.ok, true);
});

test("validateGenerateInput trims surrounding whitespace from the title", () => {
  const result = validateGenerateInput({ title: "  Atomic Habits  " });

  assert.ok(result.ok);
  assert.strictEqual(result.value.title, "Atomic Habits");
});

test("validateGenerateInput treats a missing author as absent", () => {
  const result = validateGenerateInput({ title: "Atomic Habits" });

  assert.ok(result.ok);
  assert.strictEqual(result.value.author, undefined);
});

test("validateGenerateInput treats a blank author as absent", () => {
  const result = validateGenerateInput({ title: "Atomic Habits", author: "   " });

  assert.ok(result.ok);
  assert.strictEqual(result.value.author, undefined);
});

test("validateGenerateInput rejects an empty title", () => {
  const result = validateGenerateInput({ title: "" });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects a whitespace-only title", () => {
  const result = validateGenerateInput({ title: "   " });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects a title longer than the bound", () => {
  const result = validateGenerateInput({ title: "x".repeat(TITLE_MAX + 1) });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects a missing title", () => {
  const result = validateGenerateInput({ author: "James Clear" });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects a non-string title", () => {
  const result = validateGenerateInput({ title: 42 });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput accepts an author at the length bound", () => {
  const result = validateGenerateInput({
    title: "Atomic Habits",
    author: "A".repeat(AUTHOR_MAX),
  });
  assert.strictEqual(result.ok, true);
});

test("validateGenerateInput rejects an author longer than the bound", () => {
  const result = validateGenerateInput({
    title: "Atomic Habits",
    author: "A".repeat(AUTHOR_MAX + 1),
  });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects control characters embedded in the title", () => {
  const result = validateGenerateInput({ title: "Atomic" + NUL + "Habits" });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects control characters embedded in the author", () => {
  const result = validateGenerateInput({
    title: "Atomic Habits",
    author: "James" + BEL + "Clear",
  });
  assert.strictEqual(result.ok, false);
});

test("validateGenerateInput rejects a non-object body", () => {
  assert.strictEqual(validateGenerateInput(undefined).ok, false);
  assert.strictEqual(validateGenerateInput("Atomic Habits").ok, false);
});

test("bodyTooLarge accepts a normal-sized body", () => {
  assert.strictEqual(
    bodyTooLarge({ title: "Atomic Habits", author: "James Clear" }),
    false
  );
});

test("bodyTooLarge accepts a missing body", () => {
  assert.strictEqual(bodyTooLarge(undefined), false);
  assert.strictEqual(bodyTooLarge(null), false);
});

test("bodyTooLarge rejects an oversized object body", () => {
  // Extra fields are stripped by validation, so size is the only guard against them.
  const body = { title: "Atomic Habits", junk: "x".repeat(MAX_BODY_BYTES) };
  assert.strictEqual(bodyTooLarge(body), true);
});

test("bodyTooLarge rejects an oversized string body", () => {
  assert.strictEqual(bodyTooLarge("x".repeat(MAX_BODY_BYTES + 1)), true);
});
