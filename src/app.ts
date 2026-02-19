import express, { type Express } from "express";
import routes from "./routes/index.js";

const app: Express = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Klyra API",
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
