import type { FastifyReply, FastifyRequest } from "fastify";
import { getHealth } from "../services/health.service.js";

export function health(_req: FastifyRequest, reply: FastifyReply): void {
  const data = getHealth();
  void reply.status(200).send(data);
}
