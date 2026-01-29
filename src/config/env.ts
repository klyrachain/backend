import "dotenv/config";

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
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
} as const;
