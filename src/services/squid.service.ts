import { createPublicClient, formatUnits, http } from "viem";
import { getRpcForChainId } from "../lib/constants/evm-rpc.js";
import type {
  BalanceItem,
  ChainResponse,
  TokenResponse,
} from "../lib/interfaces/squid.types.js";

/** Type for native fetch() response so TS does not resolve to Express Response (e.g. on Vercel). */
interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

const SQUID_V2_MAINNET = "https://v2.api.squidrouter.com/v2";
const SQUID_V1_TESTNET = "https://testnet.api.squidrouter.com/v1";

const ERC20_BALANCE_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    stateMutability: "view" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

function getIntegratorId(): string {
  const value =
    process.env.SQUID_INTEGRATOR_ID ??
    process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID ??
    "";
  if (!value.trim()) {
    throw new Error("SQUID_INTEGRATOR_ID is not configured.");
  }
  return value.trim();
}

function getSquidBaseUrl(testnet: boolean): string {
  return testnet ? SQUID_V1_TESTNET : SQUID_V2_MAINNET;
}

interface SquidChainRaw {
  chainId?: string;
  id?: string;
  networkIdentifier?: string;
  networkName?: string;
  chainName?: string;
  chainIconURI?: string;
  rpc?: string;
  rpcUrls?: string | string[];
  rpcs?: string[];
}

interface SquidTokenRaw {
  chainId?: string;
  address?: string;
  symbol?: string;
  decimals?: number;
  name?: string;
  logoURI?: string;
}

/** Squid API may return an array or an object with chains/data. */
type ChainsJson = SquidChainRaw[] | { chains?: SquidChainRaw[]; data?: SquidChainRaw[] };

/** Squid API may return an array or an object with tokens/data. */
type TokensJson = SquidTokenRaw[] | { tokens?: SquidTokenRaw[]; data?: SquidTokenRaw[] };

export async function fetchChains(testnet: boolean): Promise<ChainResponse[]> {
  const baseUrl = getSquidBaseUrl(testnet);
  const integratorId = getIntegratorId();
  const response = (await fetch(`${baseUrl}/chains`, {
    headers: {
      "x-integrator-id": integratorId,
      "Content-Type": "application/json",
    },
  })) as FetchResponse;

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Squid chains API error: ${responseText || response.status}`);
  }

  const data = (await response.json()) as ChainsJson;
  const rawChains: SquidChainRaw[] = Array.isArray(data) ? data : (data.chains ?? data.data ?? []);

  const mapped = rawChains
    .filter(
      (chain): chain is SquidChainRaw & { chainId: string } =>
        Boolean(chain?.chainId ?? chain?.id)
    )
    .map((chain) => {
      const chainId = String(chain.chainId ?? chain.id);
      const fromSource = chain.rpcs ?? (chain.rpcUrls ? (Array.isArray(chain.rpcUrls) ? chain.rpcUrls : [chain.rpcUrls]) : []) ?? (chain.rpc ? [chain.rpc] : []);
      const fallback = getRpcForChainId(chainId);
      const allUrls = fromSource.length > 0 ? fromSource : fallback ? [fallback] : [];
      const rpc = allUrls.length === 1 ? allUrls[0] : undefined;
      const rpcs = allUrls.length > 1 ? allUrls : undefined;
      return {
        chainId,
        networkName:
          chain.networkName ??
          chain.chainName ??
          chain.networkIdentifier ??
          chainId,
        chainIconURI: chain.chainIconURI,
        ...(rpc && { rpc }),
        ...(rpcs && { rpcs }),
      };
    });

  mapped.sort((a, b) => {
    const idA = parseInt(a.chainId, 10);
    const idB = parseInt(b.chainId, 10);
    if (!Number.isNaN(idA) && !Number.isNaN(idB)) return idA - idB;
    return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
  });
  return mapped;
}

export async function fetchTokens(testnet: boolean): Promise<TokenResponse[]> {
  const baseUrl = getSquidBaseUrl(testnet);
  const integratorId = getIntegratorId();
  const [chainsResponse, tokensResponse] = (await Promise.all([
    fetch(`${baseUrl}/chains`, {
      headers: {
        "x-integrator-id": integratorId,
        "Content-Type": "application/json",
      },
    }),
    fetch(`${baseUrl}/tokens`, {
      headers: {
        "x-integrator-id": integratorId,
        "Content-Type": "application/json",
      },
    }),
  ])) as [FetchResponse, FetchResponse];

  if (!chainsResponse.ok || !tokensResponse.ok) {
    const failedResponse = chainsResponse.ok ? tokensResponse : chainsResponse;
    const responseText = await failedResponse.text();
    throw new Error(`Squid API error: ${responseText || failedResponse.status}`);
  }

  const chainsData = (await chainsResponse.json()) as ChainsJson;
  const tokensData = (await tokensResponse.json()) as TokensJson;
  const rawChains: SquidChainRaw[] = Array.isArray(chainsData)
    ? chainsData
    : (chainsData.chains ?? chainsData.data ?? []);
  const rawTokens: SquidTokenRaw[] = Array.isArray(tokensData)
    ? tokensData
    : (tokensData.tokens ?? tokensData.data ?? []);

  const chainIdToNetworkName = new Map<string, string>();
  const chainIdToIconUri = new Map<string, string>();
  const chainIdToRpc = new Map<string, string | undefined>();
  const chainIdToRpcs = new Map<string, string[] | undefined>();
  for (const chain of rawChains) {
    const chainId = String(chain.chainId ?? chain.id ?? "");
    if (chainId) {
      chainIdToNetworkName.set(
        chainId,
        chain.networkName ??
          chain.chainName ??
          chain.networkIdentifier ??
          chainId
      );
      if (chain.chainIconURI) {
        chainIdToIconUri.set(chainId, chain.chainIconURI);
      }
      const fromSource = chain.rpcs ?? (chain.rpcUrls ? (Array.isArray(chain.rpcUrls) ? chain.rpcUrls : [chain.rpcUrls]) : []) ?? (chain.rpc ? [chain.rpc] : []);
      const fallback = getRpcForChainId(chainId);
      const allUrls = fromSource.length > 0 ? fromSource : fallback ? [fallback] : [];
      if (allUrls.length === 1) {
        chainIdToRpc.set(chainId, allUrls[0]);
      } else if (allUrls.length > 1) {
        chainIdToRpcs.set(chainId, allUrls);
      } else if (fallback) {
        chainIdToRpc.set(chainId, fallback);
      }
    }
  }

  const mapped = rawTokens
    .filter(
      (token): token is SquidTokenRaw & { chainId: string; address: string } =>
        Boolean(token?.chainId && token?.address)
    )
    .map((token) => {
      const cid = String(token.chainId);
      const rpc = chainIdToRpc.get(cid);
      const rpcs = chainIdToRpcs.get(cid);
      return {
        chainId: cid,
        networkName: chainIdToNetworkName.get(cid) ?? cid,
        chainIconURI: chainIdToIconUri.get(cid),
        address: String(token.address),
        symbol: token.symbol ?? "—",
        decimals: Number(token.decimals) || 18,
        name: token.name,
        logoURI: token.logoURI,
        ...(rpc && { rpc }),
        ...(rpcs && { rpcs }),
      };
    });

  mapped.sort((a, b) => {
    const idCompare = parseInt(a.chainId, 10) - parseInt(b.chainId, 10);
    if (!Number.isNaN(idCompare) && idCompare !== 0) return idCompare;
    if (a.chainId !== b.chainId) return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
    return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
  });
  return mapped;
}

export async function fetchBalancesMulticall(
  walletAddress: string,
  options: {
    chainId?: string;
    tokenAddress?: string;
    testnet?: boolean;
  }
): Promise<BalanceItem[]> {
  const chains = await fetchChains(Boolean(options.testnet));
  const tokens = await fetchTokens(Boolean(options.testnet));

  let tokensToFetch = tokens;
  if (options.chainId) {
    tokensToFetch = tokensToFetch.filter(
      (token) => String(token.chainId) === String(options.chainId)
    );
  }
  if (options.tokenAddress) {
    const normalizedTokenAddress = options.tokenAddress.toLowerCase();
    tokensToFetch = tokensToFetch.filter(
      (token) => token.address.toLowerCase() === normalizedTokenAddress
    );
  }

  const evmChains = chains.filter((chain) => {
    const rpc = getRpcForChainId(chain.chainId);
    return Boolean(rpc);
  });

  const results: BalanceItem[] = [];
  const walletAddressTyped = walletAddress as `0x${string}`;

  for (const chain of evmChains) {
    const rpcUrl = getRpcForChainId(chain.chainId);
    if (!rpcUrl) continue;

    const tokensOnChain = tokensToFetch.filter(
      (token) => String(token.chainId) === String(chain.chainId)
    );
    const erc20Tokens = tokensOnChain.filter(
      (token) =>
        token.address &&
        token.address !== "0x0000000000000000000000000000000000000000" &&
        token.address.toLowerCase() !== "native"
    );

    const chainIdNum = parseInt(chain.chainId, 10);
    if (Number.isNaN(chainIdNum)) continue;

    const client = createPublicClient({
      chain: {
        id: chainIdNum,
        name: chain.networkName,
        nativeCurrency: { decimals: 18, name: "", symbol: "" },
        rpcUrls: { default: { http: [rpcUrl] } },
        contracts: {
          multicall3: { address: MULTICALL3_ADDRESS },
        },
      },
      transport: http(rpcUrl),
    });

    const nativeAddress =
      "0x0000000000000000000000000000000000000000" as `0x${string}`;
    const hasNative = tokensOnChain.some(
      (token) =>
        !token.address ||
        token.address === "0x0000000000000000000000000000000000000000" ||
        token.address.toLowerCase() === "native"
    );
    if (hasNative) {
      try {
        const nativeBalance = await client.getBalance({
          address: walletAddressTyped,
        });
        const nativeToken = tokensOnChain.find(
          (token) =>
            !token.address ||
            token.address === "0x0000000000000000000000000000000000000000" ||
            token.address.toLowerCase() === "native"
        );
        const nativeDecimals = nativeToken?.decimals ?? 18;
        results.push({
          chainId: chain.chainId,
          networkName: chain.networkName,
          chainIconURI: chain.chainIconURI,
          tokenAddress: nativeAddress,
          tokenSymbol: nativeToken?.symbol ?? "ETH",
          tokenDecimals: nativeDecimals,
          tokenName: nativeToken?.name,
          tokenLogoURI: nativeToken?.logoURI,
          balance: formatUnits(nativeBalance, nativeDecimals),
          balanceRaw: String(nativeBalance),
        });
      } catch {
        // skip native on error
      }
    }

    if (erc20Tokens.length === 0) continue;

    try {
      const multicallResults = await client.multicall({
        contracts: erc20Tokens.map((token) => ({
          address: token.address as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [walletAddressTyped],
        })),
        allowFailure: true,
      });

      for (let index = 0; index < multicallResults.length; index++) {
        const result = multicallResults[index];
        const token = erc20Tokens[index];
        if (!token) continue;
        const rawBalance =
          result?.status === "success" && result.result != null
            ? BigInt(String(result.result))
            : BigInt(0);
        results.push({
          chainId: chain.chainId,
          networkName: chain.networkName,
          chainIconURI: chain.chainIconURI,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
          tokenName: token.name,
          tokenLogoURI: token.logoURI,
          balance: formatUnits(rawBalance, token.decimals),
          balanceRaw: String(rawBalance),
        });
      }
    } catch {
      // skip chain on multicall error
    }
  }

  // Sort by human-readable numeric value (highest first) so different tokens are comparable.
  results.sort((first, second) => {
    const firstValue = parseFloat(first.balance) || 0;
    const secondValue = parseFloat(second.balance) || 0;
    if (secondValue > firstValue) return 1;
    if (secondValue < firstValue) return -1;
    return 0;
  });

  return results;
}

export async function fetchBalancesFromSquid(
  walletAddress: string,
  options: {
    chainId?: string;
    tokenAddress?: string;
    testnet?: boolean;
  }
): Promise<BalanceItem[]> {
  return fetchBalancesMulticall(walletAddress, {
    chainId: options.chainId,
    tokenAddress: options.tokenAddress,
    testnet: options.testnet,
  });
}
