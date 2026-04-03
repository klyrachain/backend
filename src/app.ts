import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyExpress from "@fastify/express";
import express from "express";
import { env } from "./config/env.js";
import { registerExpressRoutes } from "./routes/index.js";

const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

await app.register(fastifyCors, {
  origin: (origin, callback) => {
    const allowed = env.cors;
    if (allowed.length === 0) return callback(null, true);
    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
});

await app.register(fastifyExpress);
app.use(express.json());

app.addHook("onRequest", async (request) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
    },
    "incoming request"
  );
});

app.addHook("onResponse", async (request, reply) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    },
    "request completed"
  );
});

app.setErrorHandler((error, request, reply) => {
  request.log.error({ err: error }, "request failed");
  if (!reply.sent) {
    void reply.status(500).send({ success: false, error: "Internal server error." });
  }
});

app.get("/", async () => {
  return {
    success: true,
    message: "Morapay API",
    docs: "See API.md for full documentation.",
    endpoints: {
      health: "/api/health",
      klyra: "/api/klyra (Core proxy)",
      moolre: "/api/moolre",
      ens: "/api/ens",
      rates: "/api/rates",
      squid: "/api/squid/chains, /api/squid/tokens, /api/squid/balances",
      balances: "/api/balances/multicall",
    },
  };
});

await registerExpressRoutes(app);

export default app;
