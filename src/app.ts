import cors from "cors";
import express, { type Express } from "express";
import { env } from "./config/env.js";
import routes from "./routes/index.js";



const app: Express = express();


app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = env.cors;
      if (allowed.length === 0) return callback(null, true);
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
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
  });
});

app.use("/api", routes);

export default app;
