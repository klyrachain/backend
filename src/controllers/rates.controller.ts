import type { FastifyReply, FastifyRequest } from "fastify";
import { getFiatQuote } from "../services/exchangerate.service.js";
import { getFonbnkQuote } from "../services/fonbnk.service.js";

export async function fiatQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const from = typeof body.from === "string" ? body.from.trim() : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const amount = body.amount != null ? Number(body.amount) : undefined;

    if (!from || !to) {
      void reply.status(400).send({
        success: false,
        error: "from and to currency codes are required (e.g. USD, GHS).",
      });
      return;
    }

    const result = await getFiatQuote({ from, to, amount });
    void reply.send({ success: true, data: result });
  } catch (error) {
    console.error("[Rates] fiat quote error", error);
    void reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : "Fiat quote failed.",
    });
  }
}

export async function fonbnkQuote(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const country = typeof body.country === "string" ? body.country.trim() : "";
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const purchaseMethod = body.purchaseMethod === "sell" ? "sell" : "buy";
    const amount = body.amount != null ? Number(body.amount) : undefined;
    const amountIn = body.amountIn === "crypto" ? "crypto" : "fiat";

    if (!country) {
      void reply.status(400).send({
        success: false,
        error: "country is required (e.g. GH for Ghana).",
      });
      return;
    }
    if (!token) {
      void reply.status(400).send({
        success: false,
        error: "token is required (e.g. USDC or BASE_USDC).",
      });
      return;
    }

    const result = await getFonbnkQuote({
      country,
      token,
      purchaseMethod,
      amount,
      amountIn,
    });

    if (!result) {
      void reply.status(404).send({
        success: false,
        error: "No quote returned from Fonbnk for this request.",
      });
      return;
    }

    void reply.send({ success: true, data: result });
  } catch (error) {
    console.error("[Rates] fonbnk quote error", error);
    void reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : "Fonbnk quote failed.",
    });
  }
}
