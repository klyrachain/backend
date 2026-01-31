import { type IRouter, Router } from "express";
import balancesRoutes from "./balances.routes.js";
import ensRoutes from "./ens.routes.js";
import healthRoutes from "./health.routes.js";
import moolreRoutes from "./moolre.routes.js";
import ratesRoutes from "./rates.routes.js";
import squidRoutes from "./squid.routes.js";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Klyra API",
    endpoints: {
      health: "/api/health",
      moolre: "/api/moolre",
      ens: "/api/ens",
      rates: "/api/rates",
      squid: "/api/squid/chains, /api/squid/tokens, /api/squid/balances",
      balances: "/api/balances/multicall",
    },
  });
});

router.use("/health", healthRoutes);
router.use("/moolre", moolreRoutes);
router.use("/ens", ensRoutes);
router.use("/rates", ratesRoutes);
router.use("/squid", squidRoutes);
router.use("/balances", balancesRoutes);

export default router;
