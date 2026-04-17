import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestHeader } from "../lib/fastify-http.js";
import { isCoreRelayAllowed, isCoreRelayPublicGet } from "../lib/peer-ramp-relay-allowlist.js";
import { callCore } from "../services/core-proxy.service.js";

const RELAY_PREFIX = "/api/klyra/relay";

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
 * Path + query after `/api/klyra/relay` (same segments Core expects under `/api/*`).
 */
function relayPathFromRequest(request: FastifyRequest): { pathOnly: string; queryString: string } {
  const full = request.url.startsWith("/") ? request.url : `/${request.url}`;
  const qidx = full.indexOf("?");
  const pathWithQuery = qidx === -1 ? full : full.slice(0, qidx);
  const queryString = qidx === -1 ? "" : full.slice(qidx + 1);

  let pathOnly = pathWithQuery;
  if (pathOnly.startsWith(RELAY_PREFIX)) {
    pathOnly = pathOnly.slice(RELAY_PREFIX.length).replace(/^\/+/, "");
  } else {
    pathOnly = pathOnly.replace(/^\/+/, "");
  }

  return { pathOnly, queryString };
}

/**
 * Server-to-server relay (e.g. Next.js BFF → here → Core). Path is everything after `/api/klyra/relay/`.
 */
export async function relayPeerRampToCore(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { pathOnly, queryString } = relayPathFromRequest(req);
  const parts = pathOnly.split("/").filter(Boolean);
  const method = (req.method || "GET").toUpperCase();

  const publicGet = method === "GET" && isCoreRelayPublicGet(parts);
  if (!publicGet && !isCoreRelayAllowed(method, parts)) {
    void reply.status(403).send({ success: false, error: "Path not allowed", code: "FORBIDDEN" });
    return;
  }

  if (method === "POST" && pathOnly === "public/gas-usage") {
    const token = getRequestHeader(req, "x-gas-report-token")?.trim();
    if (!token) {
      void reply.status(401).send({ success: false, error: "Missing X-Gas-Report-Token." });
      return;
    }
  }

  const corePath = `/api/${pathOnly}`;
  const query = relayQueryRecord(queryString);
  const body =
    method === "POST" || method === "PATCH" || method === "PUT" ? (req.body as unknown) : undefined;

  const extraHeaders: Record<string, string> | undefined =
    method === "POST" && pathOnly === "public/gas-usage"
      ? { "X-Gas-Report-Token": getRequestHeader(req, "x-gas-report-token")!.trim() }
      : undefined;

  const result = await callCore({
    method: method as "GET" | "POST",
    path: corePath,
    query,
    body,
    extraHeaders,
  });
  void reply.status(result.status).send(result.body);
}
