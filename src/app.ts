import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyExpress from "@fastify/express";
import express from "express";
import { env } from "./config/env.js";
import { registerExpressRoutes } from "./routes/index.js";

const app: FastifyInstance = Fastify({
  trustProxy: true,
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

/** Express runs before Fastify routes; handle GET / here so browsers always see JSON. */
app.use((req, res, next) => {
  const path = (req.url ?? "").split("?")[0] ?? "";
  if (req.method === "GET" && path === "/") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        success: true,
        service: "morapay-api",
        message: "Morapay integration API (proxies Core, native chains/rates/ENS, etc.).",
        hint: "Most traffic uses /api/*. This root is unauthenticated.",
        endpoints: {
          self: "/api",
          health: "/api/health",
          klyra: "/api/klyra",
          moolre: "/api/moolre",
          ens: "/api/ens",
          rates: "/api/rates",
          squid: "/api/squid",
          balances: "/api/balances/multicall",
        },
        docs: "See backend/API.md and backend/API-CORE-FLOW.md",
      })
    );
    return;
  }
  next();
});

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

await registerExpressRoutes(app);

export default app;
