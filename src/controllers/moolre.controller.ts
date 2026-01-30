import type { Request, Response } from "express";
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

export async function validateMomo(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const receiver = normalizeString(body.receiver);
    const channel = parseChannel(body.channel);
    const provider = normalizeProvider(body.provider);
    const currency = normalizeString(body.currency) ?? "GHS";

    if (!receiver) {
      res.status(400).json({ success: false, error: "receiver (mobile number) is required." });
      return;
    }

    const resolvedChannel =
      channel ?? (provider ? MOMO_PROVIDER_CHANNEL[provider] : undefined);

    if (!resolvedChannel || !MOMO_CHANNELS.includes(resolvedChannel)) {
      res.status(400).json({
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

    res.json({
      success: result.status === 1,
      accountName: result.data ?? null,
    });
  } catch (err) {
    console.error("[Moolre] validate momo error", err);
    const msg = err instanceof Error ? err.message : "MoMo validation failed.";
    if (msg.includes("Missing Moolre credentials")) {
      res.status(500).json({
        success: false,
        error: "Server configuration error: Moolre credentials not configured.",
      });
      return;
    }
    res.status(500).json({ success: false, error: msg });
  }
}

export async function validateBank(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const receiver = normalizeString(body.receiver);
    const sublistId = normalizeString(body.sublistId ?? body.bankCode);
    const currency = normalizeString(body.currency) ?? "GHS";

    if (!receiver) {
      res.status(400).json({ success: false, error: "receiver (bank account number) is required." });
      return;
    }
    if (!sublistId) {
      res.status(400).json({ success: false, error: "sublistId (bank code) is required. Use GET /api/moolre/banks to list codes." });
      return;
    }

    const result = await validateAccount({
      receiver,
      channel: 2,
      currency,
      sublistId,
    });

    res.json({
      success: result.status === 1,
      accountName: result.data ?? null,
    });
  } catch (err) {
    console.error("[Moolre] validate bank error", err);
    const msg = err instanceof Error ? err.message : "Bank validation failed.";
    if (msg.includes("Missing Moolre credentials")) {
      res.status(500).json({
        success: false,
        error: "Server configuration error: Moolre credentials not configured.",
      });
      return;
    }
    res.status(500).json({ success: false, error: msg });
  }
}

export async function sendSmsRoute(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    const recipient = normalizeString(body.recipient);
    const message = body.message;
    const senderId = normalizeString(body.senderId);
    const ref = normalizeString(body.ref);

    if (!recipient || !message) {
      res.status(400).json({
        success: false,
        error: "Recipient and message are required.",
      });
      return;
    }

    const result = await sendSms({
      senderId: senderId ?? undefined,
      messages: [{ recipient, message, ref: ref ?? undefined }],
    });

    res.json({ success: result.status === 1, data: result });
  } catch (err) {
    console.error("[Moolre] SMS error", err);
    res.status(500).json({
      success: false,
      error: "SMS dispatch failed. Please try again later.",
    });
  }
}

export async function listBanks(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req.query.country as string)?.toLowerCase() ?? "gha";
    const country: MoolreCountry = raw === "nga" ? "nga" : "gha";

    const result = await getBanks(country);
    res.json({ success: result.status === 1 || result.status === "1", data: result.data });
  } catch (err) {
    console.error("[Moolre] getBanks error", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch banks.",
    });
  }
}
