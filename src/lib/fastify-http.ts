import type { FastifyRequest } from "fastify";

/** Read header (case-insensitive) like Express `req.get(name)`. */
export function getRequestHeader(request: FastifyRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  const h = request.headers[lower];
  if (h === undefined) return undefined;
  if (typeof h === "string") return h;
  return h[0];
}
