import Anthropic from "@anthropic-ai/sdk";

import { config } from "./env";

/**
 * The Anthropic client, keyed from the config layer. Server-only — never import
 * this from browser/frontend code (it would leak `ANTHROPIC_API_KEY`). It is
 * invoked from `lib/` (e.g. `lib/generate.ts`) and ultimately from `api/`.
 */
export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
