import type Anthropic from "@anthropic-ai/sdk";

import { getAnthropicClient } from "./anthropic.js";
import { logger } from "./logger.js";
import { buildBriefPrompt } from "./prompt.js";
import { BriefSchema, type Brief } from "./schema.js";

/** Why a brief could not be produced. Discriminates `BriefGenerationError`. */
export type BriefErrorCode =
  | "refusal" // the model declined (stop_reason: "refusal")
  | "empty_response" // the model returned no text content
  | "invalid_json" // the response text was not valid JSON
  | "schema_validation"; // valid JSON, but not a valid Brief

/** A typed failure from `generateBrief`. Callers branch on `code`. */
export class BriefGenerationError extends Error {
  readonly code: BriefErrorCode;

  constructor(code: BriefErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BriefGenerationError";
    this.code = code;
  }
}

/**
 * The slice of the Anthropic client `generateBrief` depends on. Narrowing to this
 * lets tests mock the model boundary without constructing a full SDK client.
 */
interface BriefModelClient {
  messages: {
    stream(body: Anthropic.MessageStreamParams): { finalMessage(): Promise<Anthropic.Message> };
  };
}

const MODEL = "claude-opus-4-8";
// Streamed, so request timeouts aren't a concern; give thinking + the JSON brief
// ample headroom so the response never truncates mid-object (a truncated body
// would surface as `invalid_json`).
const MAX_TOKENS = 32000;

/**
 * Generates a single structured Brief for a book via Claude Opus 4.8.
 *
 * The book title (and optional author) shape the system prompt; the model streams
 * back a JSON object, which is parsed and validated against the `Brief` schema.
 * Returns a typed `Brief`, or throws a `BriefGenerationError` whose `code` says why.
 *
 * `client` is injectable so the model boundary can be mocked in tests; production
 * callers omit it and get the lazily-constructed default client.
 */
export async function generateBrief(
  title: string,
  author?: string,
  client: BriefModelClient = getAnthropicClient()
): Promise<Brief> {
  const system = buildBriefPrompt(title, author);

  const message = await client.messages
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system,
      messages: [
        { role: "user", content: "Generate the brief now. Respond with the JSON object only." },
      ],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") {
    logger.error("brief generation refused by the model", undefined, { title });
    throw new BriefGenerationError("refusal", "The model refused to generate the brief");
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    logger.error("brief generation returned no text content", undefined, { title });
    throw new BriefGenerationError("empty_response", "The model returned no text content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    logger.error(
      "brief generation returned invalid JSON",
      cause instanceof Error ? cause : undefined,
      { title }
    );
    throw new BriefGenerationError("invalid_json", "The model returned invalid JSON", { cause });
  }

  const result = BriefSchema.safeParse(parsed);
  if (!result.success) {
    logger.error("brief generation failed schema validation", result.error, { title });
    throw new BriefGenerationError(
      "schema_validation",
      "The model response did not match the Brief schema",
      { cause: result.error }
    );
  }

  return result.data;
}
