import { type IRouter, Router } from "express";
import type { FastifyInstance } from "fastify";
import balancesRoutes from "./balances.routes.js";
import ensRoutes from "./ens.routes.js";
import healthRoutes from "./health.routes.js";
import klyraRoutes from "./klyra.routes.js";
import moolreRoutes from "./moolre.routes.js";
import ratesRoutes from "./rates.routes.js";
import squidRoutes from "./squid.routes.js";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Morapay API",
    endpoints: {
      health: "/api/health",
      klyra: "/api/klyra (Core proxy: quotes, orders, paystack, offramp, transactions, chains, tokens, countries, requests, claims)",
      moolre: "/api/moolre",
      ens: "/api/ens",
      rates: "/api/rates",
      squid: "/api/squid/chains, /api/squid/tokens, /api/squid/balances",
      balances: "/api/balances/multicall",
    },
  });
});

router.use("/health", healthRoutes);
router.use("/klyra", klyraRoutes);
router.use("/moolre", moolreRoutes);
router.use("/ens", ensRoutes);
router.use("/rates", ratesRoutes);
router.use("/squid", squidRoutes);
router.use("/balances", balancesRoutes);

export default router;

export async function registerExpressRoutes(app: FastifyInstance): Promise<void> {
  app.use("/api", router);
}
