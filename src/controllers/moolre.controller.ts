import type { FastifyReply, FastifyRequest } from "fastify";
import type { MoolreCountry } from "../lib/interfaces/moolre.types.js";
import { getBanks, sendSms, validateAccount } from "../services/moolre.service.js";

const MOMO_PROVIDER_CHANNEL: Record<string, number> = {
  "MTN MOMO": 1,
  MTN: 1,
  "MTN MOBILE MONEY": 1,
  "VODAFONE CASH": 6,
  VODAFONE: 6,
  "AIRTELTIGO MONEY": 7,
  AIRTELTIGO: 7,
  "AIRTEL TIGO": 7,
};

const MOMO_CHANNELS = [1, 6, 7];

function normalizeProvider(provider?: string): string {
  return provider?.trim().toUpperCase() ?? "";
}

function parseChannel(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

export async function validateMomo(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const receiver = normalizeString(body.receiver);
    const channel = parseChannel(body.channel);
    const provider = normalizeProvider(body.provider as string | undefined);
    const currency = normalizeString(body.currency) ?? "GHS";

    if (!receiver) {
      void reply.status(400).send({ success: false, error: "receiver (mobile number) is required." });
      return;
    }

    const resolvedChannel =
      channel ?? (provider ? MOMO_PROVIDER_CHANNEL[provider] : undefined);

    if (!resolvedChannel || !MOMO_CHANNELS.includes(resolvedChannel)) {
      void reply.status(400).send({
        success: false,
        error:
          "channel (1=MTN, 6=Vodafone, 7=AirtelTigo) or provider (MTN, VODAFONE, AIRTELTIGO) is required.",
      });
      return;
    }

    const result = await validateAccount({
      receiver,
      channel: resolvedChannel,
      currency,
    });

    void reply.send({
      success: result.status === 1,
      accountName: result.data ?? null,
    });
  } catch (err) {
    console.error("[Moolre] validate momo error", err);
    const msg = err instanceof Error ? err.message : "MoMo validation failed.";
    if (msg.includes("Missing Moolre credentials")) {
      void reply.status(500).send({
        success: false,
        error: "Server configuration error: Moolre credentials not configured.",
      });
      return;
    }
    void reply.status(500).send({ success: false, error: msg });
  }
}

export async function validateBank(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const receiver = normalizeString(body.receiver);
    const sublistId = normalizeString(body.sublistId ?? body.bankCode);
    const currency = normalizeString(body.currency) ?? "GHS";

    if (!receiver) {
      void reply.status(400).send({ success: false, error: "receiver (bank account number) is required." });
      return;
    }
    if (!sublistId) {
      void reply.status(400).send({ success: false, error: "sublistId (bank code) is required. Use GET /api/moolre/banks to list codes." });
      return;
    }

    const result = await validateAccount({
      receiver,
      channel: 2,
      currency,
      sublistId,
    });

    void reply.send({
      success: result.status === 1,
      accountName: result.data ?? null,
    });
  } catch (err) {
    console.error("[Moolre] validate bank error", err);
    const msg = err instanceof Error ? err.message : "Bank validation failed.";
    if (msg.includes("Missing Moolre credentials")) {
      void reply.status(500).send({
        success: false,
        error: "Server configuration error: Moolre credentials not configured.",
      });
      return;
    }
    void reply.status(500).send({ success: false, error: msg });
  }
}

export async function sendSmsRoute(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const body = (req.body as Record<string, unknown>) ?? {};
    const recipient = normalizeString(body.recipient);
    const message = body.message;
    const senderId = normalizeString(body.senderId);
    const ref = normalizeString(body.ref);

    if (!recipient || !message) {
      void reply.status(400).send({
        success: false,
        error: "Recipient and message are required.",
      });
      return;
    }

    const result = await sendSms({
      senderId: senderId ?? undefined,
      messages: [{ recipient, message: message as string, ref: ref ?? undefined }],
    });

    void reply.send({ success: result.status === 1, data: result });
  } catch (err) {
    console.error("[Moolre] SMS error", err);
    void reply.status(500).send({
      success: false,
      error: "SMS dispatch failed. Please try again later.",
    });
  }
}

export async function listBanks(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const q = req.query as Record<string, unknown>;
    const raw = (typeof q.country === "string" ? q.country : "").toLowerCase() ?? "gha";
    const country: MoolreCountry = raw === "nga" ? "nga" : "gha";

    const result = await getBanks(country);
    void reply.send({ success: result.status === 1 || result.status === "1", data: result.data });
  } catch (err) {
    console.error("[Moolre] getBanks error", err);
    void reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch banks.",
    });
  }
}
