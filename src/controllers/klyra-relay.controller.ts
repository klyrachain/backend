import type { Request, Response } from "express";
import { isCoreRelayAllowed, isCoreRelayPublicGet } from "../lib/peer-ramp-relay-allowlist.js";
import { callCore } from "../services/core-proxy.service.js";

function relayQueryRecord(search: string): Record<string, string> | undefined {
  if (!search) return undefined;
  const sp = new URLSearchParams(search);
  const q: Record<string, string> = {};
  for (const [k, v] of sp) {
    if (v !== undefined && v !== "") q[k] = v;
  }
  return Object.keys(q).length ? q : undefined;
}

/**
 * Server-to-server relay (e.g. Next.js BFF → here → Core). Path is everything after `/api/klyra/relay/`.
 */
export async function relayPeerRampToCore(req: Request, res: Response): Promise<void> {
  const rawUrl = (req.url || "/").startsWith("/") ? req.url || "/" : `/${req.url || ""}`;
  const qidx = rawUrl.indexOf("?");
  const pathOnly = (qidx === -1 ? rawUrl : rawUrl.slice(0, qidx)).replace(/^\/+/, "");
  const queryString = qidx === -1 ? "" : rawUrl.slice(qidx + 1);
  const parts = pathOnly.split("/").filter(Boolean);
  const method = (req.method || "GET").toUpperCase();

  const publicGet = method === "GET" && isCoreRelayPublicGet(parts);
  if (!publicGet && !isCoreRelayAllowed(method, parts)) {
    res.status(403).json({ success: false, error: "Path not allowed", code: "FORBIDDEN" });
    return;
  }

  if (method === "POST" && pathOnly === "public/gas-usage") {
    const token = req.get("x-gas-report-token")?.trim();
    if (!token) {
      res.status(401).json({ success: false, error: "Missing X-Gas-Report-Token." });
      return;
    }
  }

  const corePath = `/api/${pathOnly}`;
  const query = relayQueryRecord(queryString);
  const body =
    method === "POST" || method === "PATCH" || method === "PUT" ? (req.body as unknown) : undefined;

  const extraHeaders: Record<string, string> | undefined =
    method === "POST" && pathOnly === "public/gas-usage"
      ? { "X-Gas-Report-Token": req.get("x-gas-report-token")!.trim() }
      : undefined;

  const result = await callCore({
    method: method as "GET" | "POST",
    path: corePath,
    query,
    body,
    extraHeaders,
  });
  res.status(result.status).json(result.body);
}
