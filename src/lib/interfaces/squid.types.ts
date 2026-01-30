/** Chain item returned by our chains endpoint (relevant fields only). */
export interface ChainResponse {
  chainId: string;
  networkName: string;
  chainIconURI?: string;
}

/** Token item returned by our tokens endpoint (relevant fields only). */
export interface TokenResponse {
  chainId: string;
  networkName: string;
  chainIconURI?: string;
  address: string;
  symbol: string;
  decimals: number;
  name?: string;
  logoURI?: string;
}

/** Single balance entry with token/chain info for API response. */
export interface BalanceItem {
  chainId: string;
  networkName: string;
  chainIconURI?: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenName?: string;
  tokenLogoURI?: string;
  balance: string;
  balanceRaw: string;
}
