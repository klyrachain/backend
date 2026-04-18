import type { FastifyReply, FastifyRequest } from "fastify";
import { getRequestHeader } from "../lib/fastify-http.js";
import { callCore } from "../services/core-proxy.service.js";

function queryRecord(req: FastifyRequest): Record<string, string> {
  const q = req.query as Record<string, string | string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  return out;
}

async function proxy(
  req: FastifyRequest,
  reply: FastifyReply,
  options: { method: "GET" | "POST" | "PATCH"; path: string; query?: Record<string, string>; bodyFromReq?: boolean }
): Promise<void> {
  const body = options.bodyFromReq ? req.body : undefined;
  const query = options.query ?? queryRecord(req);
  const result = await callCore({
    method: options.method,
    path: options.path,
    body,
    query: Object.keys(query).length ? query : undefined,
  });
  void reply.status(result.status).send(result.body);
}

export async function getHealth(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(_req, reply, { method: "GET", path: "/api/health" });
}

export async function getReady(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(_req, reply, { method: "GET", path: "/api/ready" });
}

export async function postQuotes(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/v1/quotes", bodyFromReq: true });
}

export async function postOrder(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/webhook/order", bodyFromReq: true });
}

export async function postPaystackInitialize(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/paystack/payments/initialize", bodyFromReq: true });
}

export async function getPaystackVerify(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const reference = (req.params as { reference?: string }).reference ?? "";
  await proxy(req, reply, { method: "GET", path: `/api/paystack/transactions/verify/${reference}` });
}

export async function getOfframpCalldata(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const transactionId = (req.query as { transaction_id?: string }).transaction_id as string;
  await proxy(req, reply, {
    method: "GET",
    path: "/api/offramp/calldata",
    query: transactionId ? { transaction_id: transactionId } : undefined,
  });
}

export async function postOfframpConfirm(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/offramp/confirm", bodyFromReq: true });
}

export async function postPayoutsRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/paystack/payouts/request", bodyFromReq: true });
}

export async function postPayoutsExecute(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/paystack/payouts/execute", bodyFromReq: true });
}

export async function getTransactionById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = (req.params as { id: string }).id;
  await proxy(req, reply, { method: "GET", path: `/api/transactions/${id}` });
}

export async function getTransactionsVerifyByHash(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const query = queryRecord(req);
  await proxy(req, reply, {
    method: "GET",
    path: "/api/transactions/verify-by-hash",
    query: Object.keys(query).length ? query : undefined,
  });
}

export async function getTransactionBalanceSnapshots(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = (req.params as { id: string }).id;
  await proxy(req, reply, { method: "GET", path: `/api/transactions/${id}/balance-snapshots` });
}

export async function getTransactionPnl(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = (req.params as { id: string }).id;
  await proxy(req, reply, { method: "GET", path: `/api/transactions/${id}/pnl` });
}

export async function getChains(_req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(_req, reply, { method: "GET", path: "/api/chains" });
}

export async function getTokens(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "GET", path: "/api/tokens", query: queryRecord(req) });
}

export async function getCountries(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "GET", path: "/api/countries" });
}

export async function getRequests(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "GET", path: "/api/requests", query: queryRecord(req) });
}

export async function postRequests(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/requests", bodyFromReq: true });
}

export async function getRequestById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = (req.params as { id: string }).id;
  await proxy(req, reply, { method: "GET", path: `/api/requests/${id}` });
}

export async function getRequestByLink(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const linkId = (req.params as { linkId?: string }).linkId ?? "";
  await proxy(req, reply, { method: "GET", path: `/api/requests/by-link/${linkId}` });
}

export async function getRequestsCalldata(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const transactionId = (req.query as { transaction_id?: string }).transaction_id as string;
  await proxy(req, reply, {
    method: "GET",
    path: "/api/requests/calldata",
    query: transactionId ? { transaction_id: transactionId } : undefined,
  });
}

export async function postRequestsConfirmCrypto(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/requests/confirm-crypto", bodyFromReq: true });
}

export async function getClaimsByCode(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const code = (req.params as { code: string }).code;
  await proxy(req, reply, { method: "GET", path: `/api/claims/by-code/${code}` });
}

export async function postClaimsVerifyOtp(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/claims/verify-otp", bodyFromReq: true });
}

export async function postClaimsClaim(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/claims/claim", bodyFromReq: true });
}

export async function postQuotesCheckout(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/v1/quotes/checkout", bodyFromReq: true });
}

export async function postQuoteSwap(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/quote/swap", bodyFromReq: true });
}

export async function postPaymentLinkDispatch(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/payment-link-dispatch", bodyFromReq: true });
}

export async function postAppTransferIntent(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "POST", path: "/api/app-transfer/intent", bodyFromReq: true });
}

export async function getPublicPaymentLinkBySlug(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const slug = (req.params as { slug?: string }).slug ?? "";
  await proxy(req, reply, {
    method: "GET",
    path: `/api/public/payment-links/${encodeURIComponent(slug)}`,
    query: queryRecord(req),
  });
}

export async function getPublicGasCheckoutPaymentLink(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const publicCode = (req.params as { publicCode?: string }).publicCode ?? "";
  await proxy(req, reply, {
    method: "GET",
    path: `/api/public/payment-links/gas-checkout/${encodeURIComponent(publicCode)}`,
    query: queryRecord(req),
  });
}

export async function getPublicPaymentLinkById(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = (req.params as { id?: string }).id ?? "";
  await proxy(req, reply, {
    method: "GET",
    path: `/api/public/payment-links/by-id/${encodeURIComponent(id)}`,
    query: queryRecord(req),
  });
}

export async function postPublicGasUsage(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = getRequestHeader(req, "x-gas-report-token")?.trim();
  if (!token) {
    void reply.status(401).send({ success: false, error: "Missing X-Gas-Report-Token." });
    return;
  }
  const result = await callCore({
    method: "POST",
    path: "/api/public/gas-usage",
    body: req.body,
    extraHeaders: { "X-Gas-Report-Token": token },
  });
  void reply.status(result.status).send(result.body);
}

export async function getPublicGasPolicy(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, { method: "GET", path: "/api/public/gas-policy", query: queryRecord(req) });
}

export async function getPublicWrappedWallet(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await proxy(req, reply, {
    method: "GET",
    path: "/api/public/wrapped/wallet",
    query: queryRecord(req),
  });
}
