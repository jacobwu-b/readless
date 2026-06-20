function getEnv(key: string, required: boolean = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** A positive-integer env var, falling back when unset or not a positive integer. */
function getIntEnv(key: string, fallback: number): number {
  const value = process.env[key];
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  NODE_ENV: getEnv("NODE_ENV") || "development",
  // Read-only, never required at import: validated lazily at the Anthropic
  // boundary via validateAnthropicConfig (issue #29), mirroring KV below.
  ANTHROPIC_API_KEY: getEnv("ANTHROPIC_API_KEY"),
  KV_REST_API_URL: getEnv("KV_REST_API_URL"),
  KV_REST_API_TOKEN: getEnv("KV_REST_API_TOKEN"),
  KV_REST_API_READ_ONLY_TOKEN: getEnv("KV_REST_API_READ_ONLY_TOKEN"),
  KV_URL: getEnv("KV_URL"),
  // Abuse controls (spec 0005 / ADR-0003). Per-IP throttle + global daily spend backstop.
  RATE_LIMIT_IP_PER_DAY: getIntEnv("RATE_LIMIT_IP_PER_DAY", 20),
  RATE_LIMIT_GLOBAL_PER_DAY: getIntEnv("RATE_LIMIT_GLOBAL_PER_DAY", 100),
};

/**
 * A required piece of server configuration is absent. Distinct from a runtime
 * failure so callers can tell a misconfigured deployment (missing API key — a 500
 * the operator must fix) apart from a genuine downstream failure the user can retry
 * (issue #53). Thrown lazily at the boundary that needs the config, never at import.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function validateAnthropicConfig() {
  if (!config.ANTHROPIC_API_KEY) {
    throw new ConfigError(
      "Missing Anthropic configuration: ANTHROPIC_API_KEY is required"
    );
  }
}

/**
 * Whether Vercel KV is configured for this deployment. KV is optional (issue #49,
 * ADR-0007): when both REST vars are absent the brief store degrades to a read-only
 * seed catalog rather than failing. Read live from `process.env` so the value tracks
 * the current environment — keeping it the single source of truth at the config layer.
 */
export function isKVConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/**
 * The live Upstash Redis REST credentials, read at the config layer so `lib/kv.ts`
 * can build its client without reading `process.env` itself (CLAUDE.md §6). Read live
 * to track the current environment, mirroring `isKVConfigured`. Both fields are only
 * present when `isKVConfigured()` is true — the only time `lib/kv.ts` builds the client.
 */
export function kvCredentials(): { url?: string; token?: string } {
  return { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN };
}
