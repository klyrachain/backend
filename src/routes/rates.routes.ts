import { type IRouter, Router } from "express";
import { fiatQuote, fonbnkQuote } from "../controllers/rates.controller.js";

const router: IRouter = Router();

router.post("/fiat", fiatQuote);
router.post("/fonbnk", fonbnkQuote);

export default router;
