import { type IRouter, Router } from "express";
import {
  getChains,
  getClaimsByCode,
  getCountries,
  getHealth,
  getOfframpCalldata,
  getReady,
  getRequestById,
  getRequests,
  getTransactionBalanceSnapshots,
  getTransactionById,
  getTransactionPnl,
  getTokens,
  postClaimsClaim,
  postClaimsVerifyOtp,
  postOfframpConfirm,
  postOrder,
  postPayoutsExecute,
  postPaystackInitialize,
  postPayoutsRequest,
  postQuotes,
} from "../controllers/klyra.controller.js";

const router: IRouter = Router();

router.get("/health", getHealth);
router.get("/ready", getReady);

router.post("/quotes", postQuotes);

router.post("/orders", postOrder);

router.post("/paystack/payments/initialize", postPaystackInitialize);
router.post("/paystack/payouts/request", postPayoutsRequest);
router.post("/paystack/payouts/execute", postPayoutsExecute);

router.get("/offramp/calldata", getOfframpCalldata);
router.post("/offramp/confirm", postOfframpConfirm);

router.get("/transactions/:id", getTransactionById);
router.get("/transactions/:id/balance-snapshots", getTransactionBalanceSnapshots);
router.get("/transactions/:id/pnl", getTransactionPnl);

router.get("/chains", getChains);
router.get("/tokens", getTokens);
router.get("/countries", getCountries);

router.get("/requests", getRequests);
router.get("/requests/:id", getRequestById);

router.get("/claims/by-code/:code", getClaimsByCode);
router.post("/claims/verify-otp", postClaimsVerifyOtp);
router.post("/claims/claim", postClaimsClaim);

export default router;
