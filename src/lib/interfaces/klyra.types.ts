/**
 * Types for Klyra/Core proxy integration.
 * Aligned with KLYRA-INTEGRATION.md, core-api.integration.md, quote-api.md.
 */

export type QuoteAction = "ONRAMP" | "OFFRAMP" | "SWAP";
export type QuoteInputSide = "from" | "to";

export interface QuoteRequestBody {
  action: QuoteAction;
  inputAmount: string;
  inputCurrency: string;
  outputCurrency: string;
  chain: string;
  inputSide?: QuoteInputSide;
}

export interface QuoteOutput {
  amount: string;
  currency: string;
  chain?: string;
}

export interface QuoteFees {
  networkFee?: string;
  platformFee?: string;
  totalFee?: string;
}

export interface QuoteResponseData {
  quoteId: string;
  expiresAt?: string;
  exchangeRate: string;
  basePrice?: string;
  prices?: { providerPrice?: string; sellingPrice?: string; avgBuyPrice?: string };
  input: { amount: string; currency: string };
  output: QuoteOutput;
  fees?: QuoteFees;
  debug?: Record<string, unknown>;
}

export type IdentityType = "ADDRESS" | "EMAIL" | "NUMBER";
export type PaymentProvider = "NONE" | "ANY" | "SQUID" | "LIFI" | "PAYSTACK" | "KLYRA";
export type OrderAction = "buy" | "sell" | "request" | "claim";

export interface OrderWebhookBody {
  action: OrderAction;
  fromIdentifier?: string | null;
  fromType?: IdentityType | null;
  fromUserId?: string | null;
  toIdentifier?: string | null;
  toType?: IdentityType | null;
  toUserId?: string | null;
  f_amount: number;
  t_amount: number;
  f_price: number;
  t_price: number;
  f_chain?: string;
  t_chain?: string;
  f_token: string;
  t_token: string;
  f_provider: PaymentProvider;
  t_provider: PaymentProvider;
  providerSessionId?: string | null;
  requestId?: string | null;
  quoteId?: string | null;
  providerPrice?: number | null;
}

export interface CoreSuccessResponse<T> {
  success: true;
  data: T;
  meta?: { page?: number; limit?: number; total?: number };
}

export interface CoreErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type TransactionStatus = "ACTIVE" | "PENDING" | "COMPLETED" | "CANCELLED" | "FAILED";
export type TransactionType = "BUY" | "SELL" | "TRANSFER" | "REQUEST" | "CLAIM";

export interface TransactionData {
  id: string;
  status: TransactionStatus;
  type: TransactionType;
  cryptoSendTxHash?: string | null;
}

export interface PaystackInitializeBody {
  email: string;
  amount: number;
  currency: string;
  transaction_id?: string;
  callback_url?: string;
}

export interface OfframpConfirmBody {
  transaction_id: string;
  tx_hash: string;
}

export interface PayoutRequestBody {
  transaction_id: string;
}

export interface PayoutExecuteBody {
  code: string;
  amount: number;
  currency: string;
  recipient_type: string;
  name: string;
  account_number?: string;
  bank_code?: string;
  [key: string]: unknown;
}

export interface ClaimVerifyOtpBody {
  claim_id?: string;
  code?: string;
  otp: string;
}

export interface ClaimBody {
  code: string;
  payout_type: "crypto" | "fiat";
  payout_target: string;
}
