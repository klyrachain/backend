import type { FiatQuoteRequest, FiatQuoteResponse } from "../lib/interfaces/rates.types.js";

const BASE_URL = "https://v6.exchangerate-api.com/v6";

function getApiKey(): string {
  const key =
    process.env.EXCHANGERATE_API_KEY ??
    process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY ??
    "";
  if (!key.trim()) {
    throw new Error("Missing EXCHANGERATE_API_KEY. Set it in environment.");
  }
  return key.trim();
}

/**
 * Fetch fiat-to-fiat quote from ExchangeRate-API. POST body: from, to, optional amount.
 * Without amount returns 1:1 rate; with amount returns conversion for that amount.
 */
export async function getFiatQuote(
  request: FiatQuoteRequest
): Promise<FiatQuoteResponse> {
  const from = String(request.from ?? "").trim().toUpperCase();
  const to = String(request.to ?? "").trim().toUpperCase();
  const amount = request.amount != null ? Number(request.amount) : undefined;

  if (!from || !to) {
    throw new Error("from and to currency codes are required.");
  }

  const apiKey = getApiKey();
  const path = amount != null && Number.isFinite(amount) && amount > 0
    ? `pair/${from}/${to}/${amount}`
    : `pair/${from}/${to}`;
  const url = `${BASE_URL}/${apiKey}/${path}`;

  const httpResponse = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const apiResponse = (await httpResponse.json()) as {
    result?: string;
    conversion_rate?: number;
    conversion_result?: number;
    base_code?: string;
    target_code?: string;
    time_last_update_utc?: string;
    "error-type"?: string;
  };

  if (!httpResponse.ok || apiResponse?.result !== "success") {
    const errorType =
      apiResponse["error-type"] ?? apiResponse?.result ?? httpResponse.statusText;
    throw new Error(`ExchangeRate API error: ${errorType}`);
  }

  const rate = Number(apiResponse.conversion_rate);
  if (!Number.isFinite(rate)) {
    throw new Error("Invalid conversion rate from ExchangeRate API.");
  }

  const response: FiatQuoteResponse = {
    from: apiResponse.base_code ?? from,
    to: apiResponse.target_code ?? to,
    rate,
    timeLastUpdateUtc: apiResponse.time_last_update_utc,
  };

  if (
    amount != null &&
    Number.isFinite(amount) &&
    apiResponse.conversion_result != null
  ) {
    response.amount = amount;
    response.convertedAmount = Number(apiResponse.conversion_result);
  }

  return response;
}
