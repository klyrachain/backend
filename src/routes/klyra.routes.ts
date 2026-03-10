import { type IRouter, Router } from "express";
import {
  getChains,
  getClaimsByCode,
  getCountries,
  getHealth,
  getOfframpCalldata,
  getPaystackVerify,
  getReady,
  getRequestById,
  getRequestByLink,
  getRequests,
  getRequestsCalldata,
  getTransactionBalanceSnapshots,
  getTransactionById,
  getTransactionPnl,
  getTransactionsVerifyByHash,
  getTokens,
  postClaimsClaim,
  postClaimsVerifyOtp,
  postOfframpConfirm,
  postOrder,
  postPayoutsExecute,
  postPaystackInitialize,
  postPayoutsRequest,
  postQuotes,
  postRequests,
  postRequestsConfirmCrypto,
} from "../controllers/klyra.controller.js";

const router: IRouter = Router();

router.get("/health", getHealth);
router.get("/ready", getReady);

router.post("/quotes", postQuotes);

router.post("/orders", postOrder);

router.post("/paystack/payments/initialize", postPaystackInitialize);
router.get("/paystack/transactions/verify/:reference", getPaystackVerify);
router.post("/paystack/payouts/request", postPayoutsRequest);
router.post("/paystack/payouts/execute", postPayoutsExecute);

router.get("/offramp/calldata", getOfframpCalldata);
router.post("/offramp/confirm", postOfframpConfirm);

router.get("/transactions/verify-by-hash", getTransactionsVerifyByHash);
router.get("/transactions/:id", getTransactionById);
router.get("/transactions/:id/balance-snapshots", getTransactionBalanceSnapshots);
router.get("/transactions/:id/pnl", getTransactionPnl);

router.get("/chains", getChains);
router.get("/tokens", getTokens);
router.get("/countries", getCountries);

router.post("/requests", postRequests);
router.get("/requests/by-link/:linkId", getRequestByLink);
router.get("/requests/calldata", getRequestsCalldata);
router.post("/requests/confirm-crypto", postRequestsConfirmCrypto);
router.get("/requests", getRequests);
router.get("/requests/:id", getRequestById);

router.get("/claims/by-code/:code", getClaimsByCode);
router.post("/claims/verify-otp", postClaimsVerifyOtp);
router.post("/claims/claim", postClaimsClaim);

export default router;
