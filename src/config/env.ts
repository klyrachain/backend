import "dotenv/config";

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string): string | undefined {
  const value = process.env[key];
  return value === "" ? undefined : value;
}

export const env = {
  get port(): number {
    const raw = getEnv("PORT");
    const port = parseInt(raw, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid PORT: "${raw}". Must be a number between 1 and 65535.`);
    }
    return port;
  },

  get coreBaseUrl(): string | undefined {
    return getEnvOptional("CORE_BASE_URL");
  },

  get coreApiKey(): string | undefined {
    return getEnvOptional("CORE_API_KEY");
  },

  get isCoreConfigured(): boolean {
    return Boolean(env.coreBaseUrl && env.coreApiKey);
  },

  /**
   * Comma-separated allowed CORS origins.
   * e.g. CORS="http://localhost:3000,http://localhost:4000" or CORS="http://localhost:3000,localhost:4000"
   * Entries without a scheme (e.g. localhost:4000) are normalized to http://.
   */
  get cors(): string[] {
    const raw = getEnvOptional("CORS");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((origin) => {
        if (origin.startsWith("http://") || origin.startsWith("https://")) {
          return origin;
        }
        return `http://${origin}`;
      });
  },
} as const;
