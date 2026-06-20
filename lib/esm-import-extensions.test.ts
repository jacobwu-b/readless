import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for the production outage where every serverless function
 * 500'd at module load.
 *
 * The functions deploy as native Node ESM (`"type": "module"`, `nodejs24.x`), and
 * Node's ESM loader does NOT resolve extensionless relative imports. An
 * extensionless `import "./kv"` in source emits verbatim and throws
 * `ERR_MODULE_NOT_FOUND` when the deployed function is loaded — before any handler
 * or try/catch runs, so it surfaces as a bare 500 on `/api/*`. `tsconfig`'s
 * NodeNext resolution now rejects this at typecheck; this test pins the same
 * contract independently, so reverting the compiler setting can't silently
 * reintroduce the outage.
 *
 * Every relative specifier (static `from "…"` and dynamic `import("…")`) in the
 * deployed source under `api/` and `lib/` must end in `.js` (TS source convention)
 * or `.json`. Test files are excluded: they never deploy as functions and run via
 * `tsx`, whose loader resolves extensionless specifiers.
 */

const ROOTS = ["api", "lib"];
const RELATIVE_SPECIFIER = /(?:from|import)\s*\(?\s*"(\.\.?\/[^"]+)"/g;

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    if (!entry.isFile() || !entry.name.endsWith(".ts")) return [];
    return entry.name.endsWith(".test.ts") ? [] : [path];
  });
}

test("every deployed relative import under api/ and lib/ carries a module extension", () => {
  const offenders: string[] = [];

  for (const root of ROOTS) {
    for (const file of tsFiles(root)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
        const specifier = match[1];
        if (specifier && !specifier.endsWith(".js") && !specifier.endsWith(".json")) {
          offenders.push(`${file}: "${specifier}"`);
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Extensionless relative imports break the deployed ESM functions ` +
      `(ERR_MODULE_NOT_FOUND at load). Add a .js extension:\n${offenders.join("\n")}`
  );
});
