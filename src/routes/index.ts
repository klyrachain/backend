import { type IRouter, Router } from "express";
import healthRoutes from "./health.routes.js";

const router: IRouter = Router();

router.use("/health", healthRoutes);

export default router;
