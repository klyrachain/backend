import { type IRouter, Router } from "express";
import { getChains, getTokens, getBalances } from "../controllers/squid.controller.js";

const router: IRouter = Router();

router.get("/chains", getChains);
router.get("/tokens", getTokens);
router.get("/balances", getBalances);

export default router;
