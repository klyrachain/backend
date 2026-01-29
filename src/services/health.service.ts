export type HealthStatus = "ok" | "degraded" | "error";

export interface HealthResult {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
}

export function getHealth(): HealthResult {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}
