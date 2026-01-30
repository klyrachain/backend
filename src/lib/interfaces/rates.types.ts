/** Request body for fiat-to-fiat conversion (ExchangeRate-API). */
export interface FiatQuoteRequest {
  from: string;
  to: string;
  amount?: number;
}

/** Normalized fiat conversion response. */
export interface FiatQuoteResponse {
  from: string;
  to: string;
  rate: number;
  amount?: number;
  convertedAmount?: number;
  timeLastUpdateUtc?: string;
}

/** Request for Fonbnk quote: country, token, buy/sell, amount, and whether amount is in fiat or crypto. */
export interface FonbnkQuoteRequest {
  country: string;
  token: string;
  purchaseMethod: "buy" | "sell";
  amount?: number;
  /** Whether amount is fiat (pay/receive in local currency) or crypto. Default "fiat". Buy+crypto = "I want this much crypto, how much fiat?"; Sell+crypto = "I sell this much crypto, how much fiat?" */
  amountIn?: "fiat" | "crypto";
}

/** Fonbnk quote response. amount = input (fiat or crypto per amountIn), total = equivalent (crypto or fiat). */
export interface FonbnkQuoteResponse {
  country: string;
  currency: string;
  network: string;
  asset: string;
  amount: number;
  rate: number;
  fee: number;
  total: number;
  paymentChannel: string;
  purchaseMethod: "buy" | "sell";
  /** Input amount was in fiat or crypto. */
  amountIn?: "fiat" | "crypto";
}
