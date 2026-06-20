import { test } from "node:test";
import assert from "node:assert";

// Issue #29: the config layer must not require ANTHROPIC_API_KEY at import time.
// Unset it before loading any module so these tests exercise the missing-key path
// regardless of the ambient environment. node --test isolates each file in its own
// process, so this deletion does not leak into other test files.
delete process.env.ANTHROPIC_API_KEY;

test("importing the config layer does not throw when ANTHROPIC_API_KEY is unset", async () => {
  const { config } = await import("./env.js");
  assert.strictEqual(config.ANTHROPIC_API_KEY, undefined);
});

test("a read-only consumer (ratelimit) imports without ANTHROPIC_API_KEY present", async () => {
  // ratelimit reads only RATE_LIMIT_* from config; it must not inherit the
  // Anthropic-key requirement just by importing the config layer.
  const { enforceRateLimit } = await import("./ratelimit.js");
  assert.strictEqual(typeof enforceRateLimit, "function");
});

test("validateAnthropicConfig throws when ANTHROPIC_API_KEY is missing", async () => {
  const { validateAnthropicConfig } = await import("./env.js");
  assert.throws(
    () => {
      validateAnthropicConfig();
    },
    /Missing Anthropic configuration/,
    "should throw a labelled error when ANTHROPIC_API_KEY is unset"
  );
});

test("getAnthropicClient throws when ANTHROPIC_API_KEY is missing", async () => {
  const { getAnthropicClient } = await import("./anthropic.js");
  assert.throws(
    () => {
      getAnthropicClient();
    },
    /Missing Anthropic configuration/,
    "the key is validated at the Anthropic boundary, not at config load"
  );
});
