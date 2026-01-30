import { type IRouter, Router } from "express";
import balancesRoutes from "./balances.routes.js";
import ensRoutes from "./ens.routes.js";
import healthRoutes from "./health.routes.js";
import moolreRoutes from "./moolre.routes.js";
import ratesRoutes from "./rates.routes.js";
import squidRoutes from "./squid.routes.js";

const router: IRouter = Router();

router.use("/health", healthRoutes);
router.use("/moolre", moolreRoutes);
router.use("/ens", ensRoutes);
router.use("/rates", ratesRoutes);
router.use("/squid", squidRoutes);
router.use("/balances", balancesRoutes);

export default router;
