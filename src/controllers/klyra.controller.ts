import type { Request, Response } from "express";
import { callCore } from "../services/core-proxy.service.js";

async function proxy(
  req: Request,
  res: Response,
  options: { method: "GET" | "POST" | "PATCH"; path: string; query?: Record<string, string>; bodyFromReq?: boolean }
): Promise<void> {
  const body = options.bodyFromReq ? req.body : undefined;
  const query = options.query ?? (req.query as Record<string, string>);
  const result = await callCore({
    method: options.method,
    path: options.path,
    body,
    query: Object.keys(query).length ? query : undefined,
  });
  res.status(result.status).json(result.body);
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  await proxy(_req, res, { method: "GET", path: "/api/health" });
}

export async function getReady(_req: Request, res: Response): Promise<void> {
  await proxy(_req, res, { method: "GET", path: "/api/ready" });
}

export async function postQuotes(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/v1/quotes", bodyFromReq: true });
}

export async function postOrder(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/webhook/order", bodyFromReq: true });
}

export async function postPaystackInitialize(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/paystack/payments/initialize", bodyFromReq: true });
}

export async function getPaystackVerify(req: Request, res: Response): Promise<void> {
  const reference = req.params.reference ?? "";
  await proxy(req, res, { method: "GET", path: `/api/paystack/transactions/verify/${reference}` });
}

export async function getOfframpCalldata(req: Request, res: Response): Promise<void> {
  const transactionId = req.query.transaction_id as string;
  await proxy(req, res, {
    method: "GET",
    path: "/api/offramp/calldata",
    query: transactionId ? { transaction_id: transactionId } : undefined,
  });
}

export async function postOfframpConfirm(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/offramp/confirm", bodyFromReq: true });
}

export async function postPayoutsRequest(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/paystack/payouts/request", bodyFromReq: true });
}

export async function postPayoutsExecute(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/paystack/payouts/execute", bodyFromReq: true });
}

export async function getTransactionById(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  await proxy(req, res, { method: "GET", path: `/api/transactions/${id}` });
}

export async function getTransactionsVerifyByHash(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  await proxy(req, res, {
    method: "GET",
    path: "/api/transactions/verify-by-hash",
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function getTransactionBalanceSnapshots(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  await proxy(req, res, { method: "GET", path: `/api/transactions/${id}/balance-snapshots` });
}

export async function getTransactionPnl(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  await proxy(req, res, { method: "GET", path: `/api/transactions/${id}/pnl` });
}

export async function getChains(_req: Request, res: Response): Promise<void> {
  await proxy(_req, res, { method: "GET", path: "/api/chains" });
}

export async function getTokens(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "GET", path: "/api/tokens", query: req.query as Record<string, string> });
}

export async function getCountries(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "GET", path: "/api/countries" });
}

export async function getRequests(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "GET", path: "/api/requests", query: req.query as Record<string, string> });
}

export async function postRequests(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/requests", bodyFromReq: true });
}

export async function getRequestById(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  await proxy(req, res, { method: "GET", path: `/api/requests/${id}` });
}

export async function getRequestByLink(req: Request, res: Response): Promise<void> {
  const linkId = req.params.linkId ?? "";
  await proxy(req, res, { method: "GET", path: `/api/requests/by-link/${linkId}` });
}

export async function getRequestsCalldata(req: Request, res: Response): Promise<void> {
  const transactionId = req.query.transaction_id as string;
  await proxy(req, res, {
    method: "GET",
    path: "/api/requests/calldata",
    query: transactionId ? { transaction_id: transactionId } : undefined,
  });
}

export async function postRequestsConfirmCrypto(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/requests/confirm-crypto", bodyFromReq: true });
}

export async function getClaimsByCode(req: Request, res: Response): Promise<void> {
  const code = req.params.code;
  await proxy(req, res, { method: "GET", path: `/api/claims/by-code/${code}` });
}

export async function postClaimsVerifyOtp(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/claims/verify-otp", bodyFromReq: true });
}

export async function postClaimsClaim(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/claims/claim", bodyFromReq: true });
}

export async function postQuotesCheckout(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/v1/quotes/checkout", bodyFromReq: true });
}

export async function postQuoteSwap(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/quote/swap", bodyFromReq: true });
}

export async function postPaymentLinkDispatch(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/payment-link-dispatch", bodyFromReq: true });
}

export async function postAppTransferIntent(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "POST", path: "/api/app-transfer/intent", bodyFromReq: true });
}

export async function getPublicPaymentLinkBySlug(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug ?? "";
  await proxy(req, res, {
    method: "GET",
    path: `/api/public/payment-links/${encodeURIComponent(slug)}`,
    query: req.query as Record<string, string>,
  });
}

export async function getPublicPaymentLinkById(req: Request, res: Response): Promise<void> {
  const id = req.params.id ?? "";
  await proxy(req, res, {
    method: "GET",
    path: `/api/public/payment-links/by-id/${encodeURIComponent(id)}`,
    query: req.query as Record<string, string>,
  });
}

export async function postPublicGasUsage(req: Request, res: Response): Promise<void> {
  const token = req.get("x-gas-report-token")?.trim();
  if (!token) {
    res.status(401).json({ success: false, error: "Missing X-Gas-Report-Token." });
    return;
  }
  const result = await callCore({
    method: "POST",
    path: "/api/public/gas-usage",
    body: req.body,
    extraHeaders: { "X-Gas-Report-Token": token },
  });
  res.status(result.status).json(result.body);
}

export async function getPublicGasPolicy(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "GET", path: "/api/public/gas-policy", query: req.query as Record<string, string> });
}

export async function getPublicWrappedWallet(req: Request, res: Response): Promise<void> {
  await proxy(req, res, {
    method: "GET",
    path: "/api/public/wrapped/wallet",
    query: req.query as Record<string, string>,
  });
}
