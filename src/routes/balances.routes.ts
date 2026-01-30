import { type IRouter, Router } from "express";
import { getMulticallBalances } from "../controllers/balances.controller.js";

const router: IRouter = Router();

router.get("/multicall", getMulticallBalances);

export default router;
