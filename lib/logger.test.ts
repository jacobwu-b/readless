import { test } from "node:test";
import assert from "node:assert";

test("logger - debug logs structured output", async () => {
  const { logger } = await import("./logger.js");
  const originalLog = console.log;
  const logs: string[] = [];

  try {
    console.log = (...args: unknown[]): void => {
      logs.push(String(args[0]));
    };

    logger.debug("test message");

    assert.strictEqual(logs.length, 1, "should log one message");
    const logStr = logs[0];
    assert(logStr !== undefined);
    const entry = JSON.parse(logStr) as Record<string, unknown>;
    assert.strictEqual(entry.level, "debug");
    assert.strictEqual(entry.message, "test message");
    assert(entry.timestamp);
  } finally {
    console.log = originalLog;
  }
});

test("logger - info logs with context", async () => {
  const { logger } = await import("./logger.js");
  const originalLog = console.log;
  const logs: string[] = [];

  try {
    console.log = (...args: unknown[]): void => {
      logs.push(String(args[0]));
    };

    logger.info("user action", { userId: "123", action: "login" });

    assert.strictEqual(logs.length, 1);
    const logStr = logs[0];
    assert(logStr !== undefined);
    const entry = JSON.parse(logStr) as Record<string, unknown>;
    assert.strictEqual(entry.level, "info");
    assert.strictEqual(entry.message, "user action");
    assert.deepStrictEqual(entry.context, { userId: "123", action: "login" });
  } finally {
    console.log = originalLog;
  }
});

test("logger - warn logs at warn level", async () => {
  const { logger } = await import("./logger.js");
  const originalLog = console.log;
  const logs: string[] = [];

  try {
    console.log = (...args: unknown[]): void => {
      logs.push(String(args[0]));
    };

    logger.warn("deprecation warning");

    assert.strictEqual(logs.length, 1);
    const logStr = logs[0];
    assert(logStr !== undefined);
    const entry = JSON.parse(logStr) as Record<string, unknown>;
    assert.strictEqual(entry.level, "warn");
  } finally {
    console.log = originalLog;
  }
});

test("logger - error logs error object", async () => {
  const { logger } = await import("./logger.js");
  const originalLog = console.log;
  const logs: string[] = [];

  try {
    console.log = (...args: unknown[]): void => {
      logs.push(String(args[0]));
    };

    const error = new Error("something failed");
    logger.error("operation failed", error, { operation: "generate" });

    assert.strictEqual(logs.length, 1);
    const logStr = logs[0];
    assert(logStr !== undefined);
    const entry = JSON.parse(logStr) as Record<string, unknown>;
    assert.strictEqual(entry.level, "error");
    assert.strictEqual(entry.message, "operation failed");
    assert.strictEqual(entry.error, "something failed");
    assert.deepStrictEqual(entry.context, { operation: "generate" });
  } finally {
    console.log = originalLog;
  }
});

test("logger - never throws on logging failure", async () => {
  const { logger } = await import("./logger.js");
  const originalLog = console.log;

  try {
    console.log = (): void => {
      throw new Error("console.log failed");
    };

    // Should not throw
    assert.doesNotThrow(() => {
      logger.info("test");
      logger.error("error", new Error("test"));
    });
  } finally {
    console.log = originalLog;
  }
});

test("logger - all methods exist", async () => {
  const { logger } = await import("./logger.js");
  assert.strictEqual(typeof logger.debug, "function");
  assert.strictEqual(typeof logger.info, "function");
  assert.strictEqual(typeof logger.warn, "function");
  assert.strictEqual(typeof logger.error, "function");
});
