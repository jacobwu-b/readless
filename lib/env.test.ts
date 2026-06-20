import { test } from "node:test";
import assert from "node:assert";

// Set required env var before importing env
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test-key";

test("env - config object has required properties", async () => {
  const { config } = await import("./env");
  assert(config.ANTHROPIC_API_KEY);
  assert(config.NODE_ENV);
  assert.strictEqual(typeof config.NODE_ENV, "string");
});

test("env - isKVConfigured is true only when both KV REST vars are set", async () => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  try {
    const { isKVConfigured } = await import("./env");

    process.env.KV_REST_API_URL = "https://example.vercel.app";
    process.env.KV_REST_API_TOKEN = "test-token";
    assert.strictEqual(isKVConfigured(), true, "both vars set → configured");

    delete process.env.KV_REST_API_URL;
    assert.strictEqual(isKVConfigured(), false, "url missing → not configured");

    process.env.KV_REST_API_URL = "https://example.vercel.app";
    delete process.env.KV_REST_API_TOKEN;
    assert.strictEqual(isKVConfigured(), false, "token missing → not configured");

    delete process.env.KV_REST_API_URL;
    assert.strictEqual(isKVConfigured(), false, "neither var set → not configured");
  } finally {
    if (url !== undefined) process.env.KV_REST_API_URL = url;
    else delete process.env.KV_REST_API_URL;
    if (token !== undefined) process.env.KV_REST_API_TOKEN = token;
    else delete process.env.KV_REST_API_TOKEN;
  }
});

test("env - validates config contains all expected properties", async () => {
  const { config } = await import("./env");
  const expectedKeys = [
    "NODE_ENV",
    "ANTHROPIC_API_KEY",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "KV_REST_API_READ_ONLY_TOKEN",
    "KV_URL",
  ];
  for (const key of expectedKeys) {
    assert(key in config, `config should have property ${key}`);
  }
});

test("env - no other module reads process.env directly", async () => {
  const { execSync } = await import("node:child_process");
  const result = execSync(
    "grep -r 'process\\.env' --include='*.ts' --exclude='*.test.ts' --exclude-dir=node_modules lib/ api/ scripts/ 2>/dev/null | grep -v 'lib/env.ts' | wc -l",
    { encoding: "utf-8" }
  ).trim();
  assert.strictEqual(
    result,
    "0",
    "Only lib/env.ts should read process.env directly"
  );
});
