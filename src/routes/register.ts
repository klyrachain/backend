import type { FastifyInstance } from "fastify";
import { health } from "../controllers/health.controller.js";
import { getMulticallBalances } from "../controllers/balances.controller.js";
import { getAddressByEnsName, getNameByAddress } from "../controllers/ens.controller.js";
import {
  getClaimsByCode,
  getClaimsByLink,
  getClaimsUnlocked,
  getCountries,
  getHealth,
  getOfframpCalldata,
  getPaystackVerify,
  getPublicGasPolicy,
  getPublicPaymentLinkById,
  getPublicGasCheckoutPaymentLink,
  getPublicPaymentLinkBySlug,
  getPublicWrappedWallet,
  getReady,
  getRequestById,
  getRequestByLink,
  getRequests,
  getRequestsCalldata,
  getTransactionBalanceSnapshots,
  getTransactionById,
  getTransactionPnl,
  getTransactionsVerifyByHash,
  postAppTransferIntent,
  postAppTransferCustodialNotify,
  postClaimsClaim,
  postClaimsSettlementSelection,
  postClaimsVerifyClaimCode,
  postClaimsVerifyOtp,
  postClaimsVerifyRecipient,
  postOfframpConfirm,
  postOrder,
  postPaymentLinkDispatch,
  postPayoutsExecute,
  postPaystackInitialize,
  postPayoutsRequest,
  postPublicGasUsage,
  postQuoteSwap,
  postQuotes,
  postQuotesCheckout,
  postRequests,
  postRequestsConfirmCrypto,
  getChains as getKlyraChains,
  getTokens as getKlyraTokens,
} from "../controllers/klyra.controller.js";
import { relayPeerRampToCore } from "../controllers/klyra-relay.controller.js";
import { listBanks, sendSmsRoute, validateBank, validateMomo } from "../controllers/moolre.controller.js";
import { fiatQuote, fonbnkQuote } from "../controllers/rates.controller.js";
import { getChains, getTokens, getBalances } from "../controllers/squid.controller.js";

/**
 * Registers all HTTP routes on the Fastify instance (pure Fastify — no Express).
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api", async (_req, reply) => {
    void reply.send({
      success: true,
      message: "Morapay API",
      endpoints: {
        health: "/api/health",
        klyra:
          "/api/klyra (Core proxy + relay): quotes, checkout/swap quotes, orders, paystack, offramp, transactions, public payment-links/gas/wrapped, payment-link-dispatch, app-transfer, chains, tokens, countries, requests, claims, relay/* for app BFF",
        moolre: "/api/moolre",
        ens: "/api/ens",
        rates: "/api/rates",
        squid: "/api/squid/chains, /api/squid/tokens, /api/squid/balances",
        balances: "/api/balances/multicall",
      },
    });
  });

  app.get("/api/health", health);

  app.register(
    async function klyraRoutes(k) {
      k.get("/health", getHealth);
      k.get("/ready", getReady);

      k.post("/v1/quotes/checkout", postQuotesCheckout);
      k.post("/quotes", postQuotes);
      k.post("/quote/swap", postQuoteSwap);
      k.post("/payment-link-dispatch", postPaymentLinkDispatch);
      k.post("/app-transfer/intent", postAppTransferIntent);
      k.post("/app-transfer/custodial-notify", postAppTransferCustodialNotify);

      k.get("/public/payment-links/by-id/:id", getPublicPaymentLinkById);
      k.get("/public/payment-links/gas-checkout/:publicCode", getPublicGasCheckoutPaymentLink);
      k.get("/public/payment-links/:slug", getPublicPaymentLinkBySlug);
      k.post("/public/gas-usage", postPublicGasUsage);
      k.get("/public/gas-policy", getPublicGasPolicy);
      k.get("/public/wrapped/wallet", getPublicWrappedWallet);

      k.post("/orders", postOrder);

      k.post("/paystack/payments/initialize", postPaystackInitialize);
      k.get("/paystack/transactions/verify/:reference", getPaystackVerify);
      k.post("/paystack/payouts/request", postPayoutsRequest);
      k.post("/paystack/payouts/execute", postPayoutsExecute);

      k.get("/offramp/calldata", getOfframpCalldata);
      k.post("/offramp/confirm", postOfframpConfirm);

      k.get("/transactions/verify-by-hash", getTransactionsVerifyByHash);
      k.get("/transactions/:id", getTransactionById);
      k.get("/transactions/:id/balance-snapshots", getTransactionBalanceSnapshots);
      k.get("/transactions/:id/pnl", getTransactionPnl);

      k.get("/chains", getKlyraChains);
      k.get("/tokens", getKlyraTokens);
      k.get("/countries", getCountries);

      k.post("/requests", postRequests);
      k.get("/requests/by-link/:linkId", getRequestByLink);
      k.get("/requests/calldata", getRequestsCalldata);
      k.post("/requests/confirm-crypto", postRequestsConfirmCrypto);
      k.get("/requests", getRequests);
      k.get("/requests/:id", getRequestById);

      k.get("/claims/by-link/:claimLinkId", getClaimsByLink);
      k.get("/claims/by-code/:code", getClaimsByCode);
      k.get("/claims/unlocked/:token", getClaimsUnlocked);
      k.post("/claims/verify-recipient", postClaimsVerifyRecipient);
      k.post("/claims/verify-otp", postClaimsVerifyOtp);
      k.post("/claims/verify-claim-code", postClaimsVerifyClaimCode);
      k.post("/claims/settlement-selection", postClaimsSettlementSelection);
      k.post("/claims/claim", postClaimsClaim);

      k.route({
        method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        url: "/relay/*",
        handler: relayPeerRampToCore,
      });
    },
    { prefix: "/api/klyra" }
  );

  app.register(
    async function moolre(m) {
      m.post("/validate/momo", validateMomo);
      m.post("/validate/bank", validateBank);
      m.post("/sms", sendSmsRoute);
      m.get("/banks", listBanks);
    },
    { prefix: "/api/moolre" }
  );

  app.register(
    async function ens(e) {
      e.get("/name/:address", getNameByAddress);
      e.get("/address", getAddressByEnsName);
    },
    { prefix: "/api/ens" }
  );

  app.register(
    async function rates(r) {
      r.post("/fiat", fiatQuote);
      r.post("/fonbnk", fonbnkQuote);
    },
    { prefix: "/api/rates" }
  );

  app.register(
    async function squid(s) {
      s.get("/chains", getChains);
      s.get("/tokens", getTokens);
      s.get("/balances", getBalances);
    },
    { prefix: "/api/squid" }
  );

  app.get("/api/balances/multicall", getMulticallBalances);
}
