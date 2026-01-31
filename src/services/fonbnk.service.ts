import crypto from "node:crypto";
import type { FonbnkQuoteRequest, FonbnkQuoteResponse } from "../lib/interfaces/rates.types.js";

/** Type for native fetch() response so TS does not resolve to Express Response (e.g. on Vercel). */
interface FetchResponse {
  ok: boolean;
  statusText: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  GH: "GHS",
  NG: "NGN",
  KE: "KES",
  TZ: "TZS",
  UG: "UGX",
  RW: "RWF",
  ZM: "ZMW",
  ZA: "ZAR",
  CI: "XOF",
  SN: "XOF",
  BJ: "XOF",
  TG: "XOF",
  CM: "XAF",
  BW: "BWP",
  MZ: "MZN",
};

function getEnvValue(...envKeys: (string | undefined)[]): string {
  for (const envKey of envKeys) {
    if (!envKey) continue;
    const envValue = process.env[envKey];
    if (envValue !== undefined && envValue !== "") return envValue;
  }
  return "";
}

function getConfig(): {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeout: number;
} {
  const baseUrl =
    getEnvValue("FONBNK_API_URL", "NEXT_PUBLIC_FONBNK_API_URL") || "https://api.fonbnk.com";
  const clientId = getEnvValue("FONBNK_CLIENT_ID", "NEXT_PUBLIC_FONBNK_CLIENT_ID");
  const clientSecret = getEnvValue(
    "FONBNK_CLIENT_SECRET",
    "NEXT_PUBLIC_FONBNK_CLIENT_SECRET"
  );
  const timeout =
    parseInt(getEnvValue("FONBNK_TIMEOUT_MS", "10000"), 10) || 10000;
  return { baseUrl, clientId, clientSecret, timeout };
}

function signRequest(
  endpoint: string,
  timestamp: string,
  clientSecret: string
): string {
  const padBase64 = (str: string): string =>
    str + "=".repeat((4 - (str.length % 4)) % 4);
  const decodedSecret = Buffer.from(padBase64(clientSecret), "base64");
  const message = `${timestamp}:${endpoint}`;
  const hmac = crypto.createHmac("sha256", decodedSecret);
  hmac.update(message, "utf8");
  return hmac.digest("base64");
}

function toPayoutCurrencyCode(token: string): string {
  const normalizedToken = token.trim().toUpperCase();
  if (normalizedToken.includes("_")) return normalizedToken;
  return `BASE_${normalizedToken}`;
}

function getCurrencyForCountry(countryCode: string): string {
  const code = countryCode.trim().toUpperCase().slice(0, 2);
  return COUNTRY_TO_CURRENCY[code] ?? "GHS";
}

interface FonbnkCashout {
  exchangeRate?: number;
  amountAfterFees?: number;
  totalChargedFees?: number;
}

interface FonbnkQuoteApiResponse {
  deposit?: {
    cashout?: FonbnkCashout;
    currencyCode?: string;
    currencyDetails?: { network?: string; asset?: string };
  };
  payout?: {
    cashout?: FonbnkCashout;
    currencyCode?: string;
    currencyDetails?: { network?: string; asset?: string; countryIsoCode?: string };
  };
}

/**
 * Fetch quote from Fonbnk. Supports amount in fiat or crypto for both buy and sell.
 * Buy + amountIn fiat: deposit fiat amount → total = crypto received.
 * Buy + amountIn crypto: request crypto amount → total = fiat to pay.
 * Sell: deposit crypto amount → total = fiat received (always crypto amount in).
 */
export async function getFonbnkQuote(
  request: FonbnkQuoteRequest
): Promise<FonbnkQuoteResponse | null> {
  const { baseUrl, clientId, clientSecret, timeout } = getConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Missing FONBNK_CLIENT_ID or FONBNK_CLIENT_SECRET.");
  }

  const countryCode = request.country.trim().toUpperCase().slice(0, 2);
  const currency = getCurrencyForCountry(request.country);
  const payoutCurrencyCode = toPayoutCurrencyCode(request.token);
  const isBuy = request.purchaseMethod === "buy";
  const amountIn = request.amountIn === "crypto" ? "crypto" : "fiat";
  const defaultFiatAmount = 100;
  const defaultCryptoAmount = 1;
  const amount =
    request.amount != null &&
    Number.isFinite(request.amount) &&
    request.amount > 0
      ? request.amount
      : isBuy
        ? amountIn === "crypto"
          ? defaultCryptoAmount
          : defaultFiatAmount
        : defaultCryptoAmount;

  const endpoint = "/api/v2/quote";
  const timestamp = Date.now().toString();
  const signature = signRequest(endpoint, timestamp, clientSecret);

  const requestBody = isBuy
    ? amountIn === "crypto"
      ? {
          deposit: {
            paymentChannel: "mobile_money" as const,
            currencyType: "fiat" as const,
            currencyCode: currency,
            countryIsoCode: countryCode,
          },
          payout: {
            paymentChannel: "crypto" as const,
            currencyType: "crypto" as const,
            currencyCode: payoutCurrencyCode,
            amount,
          },
        }
      : {
          deposit: {
            paymentChannel: "mobile_money" as const,
            currencyType: "fiat" as const,
            currencyCode: currency,
            countryIsoCode: countryCode,
            amount,
          },
          payout: {
            paymentChannel: "crypto" as const,
            currencyType: "crypto" as const,
            currencyCode: payoutCurrencyCode,
          },
        }
    : {
        deposit: {
          paymentChannel: "crypto" as const,
          currencyType: "crypto" as const,
          currencyCode: payoutCurrencyCode,
          amount,
        },
        payout: {
          paymentChannel: "mobile_money" as const,
          currencyType: "fiat" as const,
          currencyCode: currency,
          countryIsoCode: countryCode,
        },
      };

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  const httpResponse = (await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-timestamp": timestamp,
      "x-signature": signature,
    },
    body: JSON.stringify(requestBody),
    signal: abortController.signal,
  })) as FetchResponse;

  clearTimeout(timeoutId);

  if (!httpResponse.ok) {
    const responseText = await httpResponse.text();
    let errorMessage: string;
    try {
      const parsedError = JSON.parse(responseText) as { message?: string };
      errorMessage = parsedError.message ?? responseText;
    } catch {
      errorMessage = responseText || httpResponse.statusText;
    }
    throw new Error(`Fonbnk API error: ${errorMessage}`);
  }

  const apiResponse = (await httpResponse.json()) as FonbnkQuoteApiResponse;

  if (isBuy) {
    const depositCashout = apiResponse.deposit?.cashout;
    const payoutCashout = apiResponse.payout?.cashout;
    if (!depositCashout) return null;
    const exchangeRate = depositCashout.exchangeRate;
    if (exchangeRate == null || Number(exchangeRate) <= 0) return null;

    if (amountIn === "crypto") {
      const fiatToPay =
        depositCashout.amountAfterFees ??
        (exchangeRate != null ? amount * Number(exchangeRate) : null);
      return {
        country: countryCode,
        currency,
        network:
          apiResponse.payout?.currencyDetails?.network?.toLowerCase() ?? "base",
        asset: apiResponse.payout?.currencyDetails?.asset ?? "USDC",
        amount,
        rate: Number(exchangeRate),
        fee: Number(depositCashout.totalChargedFees ?? 0),
        total:
          fiatToPay != null ? Number(fiatToPay) : amount * Number(exchangeRate),
        paymentChannel: "mobile_money",
        purchaseMethod: "buy",
        amountIn: "crypto",
      };
    }

    const totalCryptoReceived = payoutCashout?.amountAfterFees ?? null;
    return {
      country: countryCode,
      currency,
      network:
        apiResponse.payout?.currencyDetails?.network?.toLowerCase() ?? "base",
      asset: apiResponse.payout?.currencyDetails?.asset ?? "USDC",
      amount,
      rate: Number(exchangeRate),
      fee: Number(depositCashout.totalChargedFees ?? 0),
      total:
        totalCryptoReceived != null
          ? Number(totalCryptoReceived)
          : amount / Number(exchangeRate),
      paymentChannel: "mobile_money",
      purchaseMethod: "buy",
      amountIn: "fiat",
    };
  }

  const payoutCashout = apiResponse.payout?.cashout;
  if (!payoutCashout) return null;
  const exchangeRate = payoutCashout.exchangeRate;
  if (exchangeRate == null || Number(exchangeRate) <= 0) return null;
  return {
    country: countryCode,
    currency: apiResponse.payout?.currencyCode ?? currency,
    network:
      apiResponse.deposit?.currencyDetails?.network?.toLowerCase() ?? "base",
    asset: apiResponse.deposit?.currencyDetails?.asset ?? "USDC",
    amount,
    rate: Number(exchangeRate),
    fee: Number(payoutCashout.totalChargedFees ?? 0),
    total: Number(payoutCashout.amountAfterFees ?? amount),
    paymentChannel: "mobile_money",
    purchaseMethod: "sell",
    amountIn: "crypto",
  };
}
