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

export async function getCountries(_req: Request, res: Response): Promise<void> {
  await proxy(_req, res, { method: "GET", path: "/api/countries" });
}

export async function getRequests(req: Request, res: Response): Promise<void> {
  await proxy(req, res, { method: "GET", path: "/api/requests", query: req.query as Record<string, string> });
}

export async function getRequestById(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  await proxy(req, res, { method: "GET", path: `/api/requests/${id}` });
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
