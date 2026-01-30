/**
 * Moolre API base response shape.
 * @property status - 1 or "1" for success
 * @property code - Response code (e.g. AVD01, DA01)
 * @property data - Payload (string, array, or null)
 */
export interface MoolreResponse<T = unknown> {
  status: number | string;
  code: string;
  message: string;
  data: T;
  go: unknown;
}

/** Account name validation result. `data` is the account holder name. */
export type ValidateAccountResponse = MoolreResponse<string | null>;

/**
 * Params for validating a mobile money or bank account name.
 * @property receiver - Mobile money number or bank account number
 * @property channel - 1=MTN, 6=Vodafone, 7=AirtelTigo, 2=Bank
 * @property currency - e.g. GHS, NGN (default GHS)
 * @property sublistId - Bank code when channel is 2
 */
export interface ValidateAccountParams {
  receiver: string;
  channel: number;
  currency?: string;
  sublistId?: string;
}

/**
 * Single SMS item for send request.
 * @property recipient - Phone number
 * @property message - SMS body
 * @property ref - Optional reference (default: UUID)
 */
export interface SendSmsMessage {
  recipient: string;
  message: string;
  ref?: string;
}

/**
 * Params for sending SMS via Moolre.
 * @property senderId - Optional sender ID override
 * @property messages - Array of recipient/message/ref
 */
export interface SendSmsParams {
  senderId?: string;
  messages: SendSmsMessage[];
}

/** Bank item from Moolre data endpoint. code = bank code (sublistid), name = bank name. */
export interface MoolreBank {
  code: string;
  name: string;
}

/** Response from Moolre get-banks (data) endpoint. data is array of MoolreBank. */
export type GetBanksResponse = MoolreResponse<MoolreBank[]>;

/** Country code for data endpoints: gha = Ghana, nga = Nigeria. */
export type MoolreCountry = "gha" | "nga";
