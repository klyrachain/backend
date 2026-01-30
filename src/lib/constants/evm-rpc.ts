/**
 * Fallback RPC URLs for EVM chains (used when balance fetching needs an RPC).
 */
export const EVM_RPC_BY_CHAIN_ID: Record<string, string> = {
  "1": "https://eth.llamarpc.com",
  "137": "https://polygon.llamarpc.com",
  "42161": "https://arbitrum.llamarpc.com",
  "8453": "https://mainnet.base.org",
  "43114": "https://api.avax.network/ext/bc/C/rpc",
  "10": "https://mainnet.optimism.io",
  "56": "https://bsc-dataseed.binance.org",
  "250": "https://rpc.ftm.tools",
  "324": "https://mainnet.zksync.io",
  "59144": "https://linea-mainnet.infura.io",
  "11155111": "https://rpc.sepolia.org",
  "84532": "https://sepolia.base.org",
};

export function getRpcForChainId(chainId: string): string | undefined {
  return EVM_RPC_BY_CHAIN_ID[chainId];
}
