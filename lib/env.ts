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

export function validateAnthropicConfig() {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error(
      "Missing Anthropic configuration: ANTHROPIC_API_KEY is required"
    );
  }
}

export function validateKVConfig() {
  if (!config.KV_REST_API_URL || !config.KV_REST_API_TOKEN) {
    throw new Error(
      "Missing Vercel KV configuration: KV_REST_API_URL and KV_REST_API_TOKEN are required"
    );
  }
}
