/**
 * Proxies HTTP requests to the Core backend with x-api-key.
 * Core base URL and API key are never exposed to the frontend.
 */

import { env } from "../config/env.js";

const CORE_PATHS_NO_AUTH = new Set(["/api/health", "/api/ready"]);

/** Fetch API response shape (avoids conflict with Express Response). */
interface FetchResponseLike {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface CoreProxyOptions {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string>;
  useApiKey?: boolean;
}

export interface CoreProxyResult {
  status: number;
  body: unknown;
  ok: boolean;
}

function buildUrl(base: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, base);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }
  return url.toString();
}

export async function callCore(options: CoreProxyOptions): Promise<CoreProxyResult> {
  const { coreBaseUrl, coreApiKey, isCoreConfigured } = env;

  if (!isCoreConfigured) {
    return {
      status: 503,
      ok: false,
      body: {
        success: false,
        error: "Core backend is not configured. Set CORE_BASE_URL and CORE_API_KEY.",
      },
    };
  }

  const baseUrl = coreBaseUrl!.replace(/\/$/, "");
  const url = buildUrl(baseUrl, options.path, options.query);
  const skipAuth = CORE_PATHS_NO_AUTH.has(options.path);
  const useApiKey = options.useApiKey !== false && !skipAuth && coreApiKey;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (useApiKey) {
    headers["x-api-key"] = coreApiKey!;
  }

  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method: options.method,
    headers,
  };
  if (options.body !== undefined && (options.method === "POST" || options.method === "PATCH" || options.method === "PUT")) {
    init.body = JSON.stringify(options.body);
  }

  try {
    const res = (await fetch(url, init as RequestInit)) as FetchResponseLike;
    let body: unknown;
    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      body = await res.json();
    } else {
      const text = await res.text();
      body = text ? { raw: text } : undefined;
    }
    return {
      status: res.status,
      ok: res.ok,
      body,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      status: 502,
      ok: false,
      body: {
        success: false,
        error: `Core request failed: ${message}`,
      },
    };
  }
}
