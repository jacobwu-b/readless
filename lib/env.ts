function getEnv(key: string, required: boolean = false): string | undefined {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  NODE_ENV: getEnv("NODE_ENV") || "development",
  ANTHROPIC_API_KEY: getEnv("ANTHROPIC_API_KEY", true),
  KV_REST_API_URL: getEnv("KV_REST_API_URL"),
  KV_REST_API_TOKEN: getEnv("KV_REST_API_TOKEN"),
  KV_REST_API_READ_ONLY_TOKEN: getEnv("KV_REST_API_READ_ONLY_TOKEN"),
  KV_URL: getEnv("KV_URL"),
};

export function validateKVConfig() {
  if (!config.KV_REST_API_URL || !config.KV_REST_API_TOKEN) {
    throw new Error(
      "Missing Vercel KV configuration: KV_REST_API_URL and KV_REST_API_TOKEN are required"
    );
  }
}
