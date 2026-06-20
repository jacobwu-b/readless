import Anthropic from "@anthropic-ai/sdk";

import { config, validateAnthropicConfig } from "./env";

let client: Anthropic | undefined;

/**
 * Returns the Anthropic client, constructed lazily and memoized per process.
 *
 * `ANTHROPIC_API_KEY` is validated here — at first use — rather than at config
 * load, so importing the config layer (or this module) on a read-only path never
 * trips a missing-key throw (issue #29).
 *
 * Server-only — never import this from browser/frontend code (it would leak
 * `ANTHROPIC_API_KEY`). It is invoked from `lib/` (e.g. `lib/generate.ts`) and
 * ultimately from `api/`.
 */
export function getAnthropicClient(): Anthropic {
  if (!client) {
    validateAnthropicConfig();
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}
