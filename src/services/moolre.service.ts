import { randomUUID } from "node:crypto";
import type {
  GetBanksResponse,
  MoolreCountry,
  SendSmsParams,
  ValidateAccountParams,
  ValidateAccountResponse,
} from "../lib/interfaces/moolre.types.js";

/** Type for native fetch() response so TS does not resolve to Express Response (e.g. on Vercel). */
interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

function getEnv(...keys: (string | undefined)[]): string | undefined {
  for (const key of keys) {
    if (!key) continue;
    const value = process.env[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function buildBaseUrl(): string {
  const raw =
    getEnv(
      "MOOLRE_API_BASE_URL",
      "NEXT_PUBLIC_MOOLRE_API_BASE_URL",
      "MOOLRE_API_BASE_URL",
      "NEXT_PUBLIC_MOOLRE_API_BASE_URL"
    ) ?? "https://api.moolre.com";
  return raw.replace(/\/$/, "");
}

function getCredentials(): {
  baseUrl: string;
  apiUser: string;
  apiKey: string;
  accountNumber: string;
} {
  const baseUrl = buildBaseUrl();
  const apiUser =
    getEnv(
      "MOOLRE_USERNAME",
      "NEXT_PUBLIC_MOOLRE_USERNAME",
      "MOOLRE_USERNAME",
      "NEXT_PUBLIC_MOOLRE_USERNAME"
    ) ?? "";
  const apiKey =
    getEnv(
      "MOOLRE_PRIVATE_API_KEY",
      "NEXT_PUBLIC_MOOLRE_PRIVATE_API_KEY",
      "MOOLRE_PRIVATE_API_KEY",
      "NEXT_PUBLIC_MOOLRE_PRIVATE_API_KEY",
      "NEXT_PUBLIC_MOOLRE_PUBLIC_API_KEY",
      "NEXT_PUBLIC_MOOLRE_PUBLIC_API_KEY"
    ) ?? "";
  const accountNumber =
    getEnv(
      "MOOLRE_ACCOUNT_NUMBER",
      "NEXT_PUBLIC_MOOLRE_ACCOUNT_NUMBER",
      "MOOLRE_ACCOUNT_NUMBER",
      "NEXT_PUBLIC_MOOLRE_ACCOUNT_NUMBER"
    ) ?? "";

  if (!apiUser || !apiKey || !accountNumber) {
    throw new Error(
      "Missing Moolre credentials. Ensure username, API key, and account number are configured."
    );
  }
  return { baseUrl, apiUser, apiKey, accountNumber };
}

function getSmsCredentials(): { senderId: string; smsApiKey: string } {
  const senderId =
    getEnv(
      "MOOLRE_SMS_SENDER_ID",
      "NEXT_PUBLIC_MOOLRE_SMS_SENDER_ID",
      "MOOLRE_SMS_SENDER_ID",
      "NEXT_PUBLIC_MOOLRE_SMS_SENDER_ID"
    ) ?? "";
  const smsApiKey =
    getEnv(
      "MOOLRE_SMS_API_KEY",
      "NEXT_PUBLIC_MOOLRE_SMS_API_KEY",
      "MOOLRE_SMS_API_KEY",
      "NEXT_PUBLIC_MOOLRE_SMS_API_KEY"
    ) ?? "";
  if (!smsApiKey) {
    throw new Error(
      "Missing Moolre SMS API key. Configure MOOLRE_SMS_API_KEY to enable SMS notifications."
    );
  }
  return { senderId, smsApiKey };
}

/**
 * Validates a mobile money or bank account name. Backend sets type and account number.
 * @param params - receiver, channel, optional currency and sublistId (for bank)
 * @returns Moolre validate response; data is account holder name
 */
export async function validateAccount(
  params: ValidateAccountParams
): Promise<ValidateAccountResponse> {
  const { baseUrl, apiUser, apiKey, accountNumber } = getCredentials();
  const { receiver, channel, currency = "GHS", sublistId } = params;

  const channelNum = typeof channel === "string" ? parseInt(channel, 10) : channel;
  if (!receiver?.trim()) throw new Error("Receiver is required");
  if (!channelNum || Number.isNaN(channelNum))
    throw new Error("Valid channel is required");
  if (!accountNumber.trim())
    throw new Error("Moolre account number is not configured. Set MOOLRE_ACCOUNT_NUMBER.");

  const payload: Record<string, unknown> = {
    type: 1,
    receiver: String(receiver).trim(),
    channel: channelNum,
    currency: String(currency).toUpperCase(),
    accountnumber: String(accountNumber).trim(),
  };
  if (sublistId && channelNum === 2) {
    payload.sublistid = String(sublistId).trim();
  }

  const res = (await fetch(`${baseUrl}/open/transact/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-USER": apiUser,
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  })) as FetchResponse;

  const text = await res.text();
  if (!res.ok) throw new Error(`Moolre validation failed with status ${res.status}: ${text}`);
  return JSON.parse(text) as ValidateAccountResponse;
}

/**
 * Sends SMS via Moolre. Generates ref with randomUUID when not provided.
 * @param params - senderId (optional), messages array
 */
export async function sendSms(
  params: SendSmsParams
): Promise<ValidateAccountResponse> {
  const baseUrl = buildBaseUrl();
  const { senderId: defaultSenderId, smsApiKey } = getSmsCredentials();
  const { senderId, messages } = params;

  const payload = {
    type: 1,
    senderid: senderId ?? defaultSenderId,
    messages: messages.map((m) => ({
      recipient: m.recipient,
      message: m.message,
      ref: m.ref ?? randomUUID(),
    })),
  };

  const res = (await fetch(`${baseUrl}/open/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-VASKEY": smsApiKey,
    },
    body: JSON.stringify(payload),
  })) as FetchResponse;

  const text = await res.text();
  if (!res.ok) throw new Error(`Moolre SMS failed with status ${res.status}: ${text}`);
  return JSON.parse(text) as ValidateAccountResponse;
}

/**
 * Fetches list of banks for the given country. No auth required by Moolre for this endpoint.
 * @param country - gha (Ghana) or nga (Nigeria)
 */
export async function getBanks(
  country: MoolreCountry
): Promise<GetBanksResponse> {
  const baseUrl = buildBaseUrl();
  const url = `${baseUrl}/open/transact/data?country=${country}&data=banks`;
  const res = (await fetch(url)) as FetchResponse;
  const text = await res.text();
  if (!res.ok) throw new Error(`Moolre get banks failed with status ${res.status}: ${text}`);
  return JSON.parse(text) as GetBanksResponse;
}
