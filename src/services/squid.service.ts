import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, formatUnits, http } from "viem";
import {
  getMainnetRegistry,
  getTestnetRegistry,
} from "../lib/constants/chain-registry.js";
import { getRpcForChainId } from "../lib/constants/evm-rpc.js";
import type {
  BalanceItem,
  ChainResponse,
  TokenResponse,
} from "../lib/interfaces/squid.types.js";
import {
  SOLANA_CHAIN_ICON_FALLBACK,
  fetchChainsFromCore,
  fetchTokensFromCore,
  isSquidRateLimitError,
} from "./core-chains-tokens-fallback.service.js";

function getTokensDir(): string {
  return join(process.cwd(), "data", "tokens");
}

interface TokenListFileEntry {
  chainId?: number;
  address?: string;
  symbol?: string;
  decimals?: number;
  name?: string;
  logoURI?: string;
}

function loadTokenListTokens(filename: string): TokenListFileEntry[] {
  const dir = getTokensDir();
  const path = join(dir, filename);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as { tokens?: TokenListFileEntry[] } | TokenListFileEntry[];
    return Array.isArray(data) ? data : (data.tokens ?? []);
  } catch {
    return [];
  }
}

function loadMainnetTokensFromFileFallback(): TokenResponse[] {
  const registry = getMainnetRegistry();
  const chainNameById = new Map(registry.map((c) => [String(c.id), c.name]));
  const rpcById = new Map(
    registry
      .filter((c) => c.rpcs.length === 1)
      .map((c) => [String(c.id), c.rpcs[0]])
  );
  const rpcsById = new Map(
    registry
      .filter((c) => c.rpcs.length > 1)
      .map((c) => [String(c.id), c.rpcs])
  );

  const fileTokens = loadTokenListTokens("mainnet.tokens.json");
  const mapped = fileTokens
    .filter(
      (t): t is TokenListFileEntry & { chainId: number; address: string } =>
        typeof t.chainId === "number" &&
        typeof t.address === "string" &&
        t.address.length > 0
    )
    .map((t) => {
      const chainId = String(t.chainId);
      return {
        chainId,
        networkName: chainNameById.get(chainId) ?? chainId,
        chainIconURI:
          chainId === "101" ? SOLANA_CHAIN_ICON_FALLBACK : undefined,
        address: t.address,
        symbol: t.symbol ?? "—",
        decimals: Number(t.decimals) || 18,
        name: t.name,
        logoURI: t.logoURI,
        ...(rpcById.get(chainId) && { rpc: rpcById.get(chainId) }),
        ...(rpcsById.get(chainId) && { rpcs: rpcsById.get(chainId) }),
      };
    });

  mapped.sort((a, b) => {
    const idA = parseInt(a.chainId, 10);
    const idB = parseInt(b.chainId, 10);
    if (!Number.isNaN(idA) && !Number.isNaN(idB) && idA !== idB) {
      return idA - idB;
    }
    if (a.chainId !== b.chainId) {
      return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
    }
    return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
  });
  return mapped;
}

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

export { SOLANA_CHAIN_ICON_FALLBACK } from "./core-chains-tokens-fallback.service.js";

type BalanceSource = "squid" | "multicall" | "merged";
type SourcedBalanceItem = BalanceItem & { source?: BalanceSource };

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

function getRpcUrlForChain(chain: ChainResponse): string | undefined {
  return chain.rpc ?? chain.rpcs?.[0] ?? getRpcForChainId(chain.chainId);
}

/** All RPC URLs for a chain (single + multiple + fallback), used to try in order for balances. */
function getRpcUrlsForChain(chain: ChainResponse): string[] {
  const fallback = getRpcForChainId(chain.chainId);
  if (chain.rpc) return [chain.rpc, ...(fallback && fallback !== chain.rpc ? [fallback] : [])];
  if (chain.rpcs && chain.rpcs.length > 0) {
    const withFallback = fallback && !chain.rpcs.includes(fallback) ? [...chain.rpcs, fallback] : chain.rpcs;
    return withFallback;
  }
  return fallback ? [fallback] : [];
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

const NATIVE_TOKEN_FALLBACK_BY_CHAIN: Record<
  string,
  { symbol: string; name: string; decimals: number; address: string }
> = {
  "8332": { symbol: "BTC", name: "Bitcoin", decimals: 8, address: "native" },
  "148": { symbol: "XLM", name: "Stellar Lumens", decimals: 7, address: "native" },
};

/** Squid API may return an array or an object with chains/data. */
type ChainsJson = SquidChainRaw[] | { chains?: SquidChainRaw[]; data?: SquidChainRaw[] };

/** Squid API may return an array or an object with tokens/data. */
type TokensJson = SquidTokenRaw[] | { tokens?: SquidTokenRaw[]; data?: SquidTokenRaw[] };

/** In-memory cache so checkout + modal + balances do not hammer Squid HTTP (RATE_LIMIT). */
const SQUID_HTTP_CACHE_MS = 15 * 60 * 1000;
const SQUID_BALANCE_CACHE_MS = 30 * 1000;
const BALANCE_SCAN_RPC_TIMEOUT_MS = 4500;
const MAX_BALANCE_TOKENS_PER_CHAIN = 80;
const MAX_BALANCE_CHAINS = 6;
const BALANCE_CHAIN_ALLOWLIST = new Set([
  "1", // Ethereum
  "10", // Optimism
  "56", // BSC
  "137", // Polygon
  "42220", // Celo
  "42161", // Arbitrum
  "8453", // Base
]);
const BALANCE_PRIORITY_SYMBOLS = new Set([
  "ETH",
  "WETH",
  "USDC",
  "USDT",
  "DAI",
  "MATIC",
  "WMATIC",
  "BNB",
  "WBNB",
  "WBTC",
]);
type SquidHttpCacheEntry<T> = { storedAt: number; data: T };
const squidChainsHttpCache = new Map<string, SquidHttpCacheEntry<ChainResponse[]>>();
const squidTokensHttpCache = new Map<string, SquidHttpCacheEntry<TokenResponse[]>>();
const squidTokensInflight = new Map<string, Promise<TokenResponse[]>>();
const squidBalancesCache = new Map<string, SquidHttpCacheEntry<BalanceItem[]>>();
const squidBalancesInflight = new Map<string, Promise<BalanceItem[]>>();

const CASE_SENSITIVE_CHAIN_IDS = new Set([
  "101",
  "148",
  "8332",
  "bitcoin",
  "btc",
  "stellar",
]);

function normalizeAddressForChain(chainId: string, address: string): string {
  const raw = address.trim();
  if (!raw) return "";
  const normalizedChain = chainId.trim().toLowerCase();
  return CASE_SENSITIVE_CHAIN_IDS.has(normalizedChain) ? raw : raw.toLowerCase();
}

function toBalanceNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function balanceIdentityKey(item: BalanceItem): string {
  return `${item.chainId}:${normalizeAddressForChain(item.chainId, item.tokenAddress)}`;
}

function mapSource(items: BalanceItem[], source: BalanceSource): SourcedBalanceItem[] {
  return items.map((item) => ({ ...item, source }));
}

function pickPreferredBalance(
  current: SourcedBalanceItem,
  incoming: SourcedBalanceItem
): SourcedBalanceItem {
  const currentValue = toBalanceNumber(current.balance);
  const incomingValue = toBalanceNumber(incoming.balance);
  if (incomingValue > 0 && currentValue <= 0) {
    return { ...current, ...incoming, source: "merged" };
  }
  if (currentValue > 0 && incomingValue <= 0) {
    return { ...incoming, ...current, source: "merged" };
  }
  return { ...incoming, ...current, source: "merged" };
}

function mergeBalanceSources(
  squidItems: SourcedBalanceItem[],
  multicallItems: SourcedBalanceItem[]
): SourcedBalanceItem[] {
  const merged = new Map<string, SourcedBalanceItem>();
  for (const item of squidItems) {
    merged.set(balanceIdentityKey(item), item);
  }
  for (const item of multicallItems) {
    const key = balanceIdentityKey(item);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, pickPreferredBalance(current, item));
  }
  return [...merged.values()];
}

function readSquidHttpCache<T>(
  map: Map<string, SquidHttpCacheEntry<T>>,
  key: string
): T | null {
  const row = map.get(key);
  if (!row) return null;
  if (Date.now() - row.storedAt > SQUID_HTTP_CACHE_MS) {
    return null;
  }
  return row.data;
}

function readSquidHttpCacheStale<T>(
  map: Map<string, SquidHttpCacheEntry<T>>,
  key: string
): T | null {
  return map.get(key)?.data ?? null;
}

function writeSquidHttpCache<T>(
  map: Map<string, SquidHttpCacheEntry<T>>,
  key: string,
  data: T
): void {
  map.set(key, { storedAt: Date.now(), data });
}

function readBalanceCache(key: string): BalanceItem[] | null {
  const row = squidBalancesCache.get(key);
  if (!row) return null;
  if (Date.now() - row.storedAt > SQUID_BALANCE_CACHE_MS) return null;
  return row.data;
}

function tokenBalancePriority(token: TokenResponse): number {
  let score = 0;
  if (BALANCE_PRIORITY_SYMBOLS.has(token.symbol.toUpperCase())) score += 100;
  if (token.address === "0x0000000000000000000000000000000000000000") score += 50;
  if (token.address.toLowerCase() === "native") score += 50;
  return score;
}

function mergeRpcUrls(...sources: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const arr of sources) {
    if (!Array.isArray(arr)) continue;
    for (const u of arr) {
      if (typeof u === "string" && u.trim()) seen.add(u.trim());
    }
  }
  return [...seen];
}

export async function fetchChains(testnet: boolean): Promise<ChainResponse[]> {
  const chainsCacheKey = testnet ? "chains-testnet" : "chains-mainnet";
  const chainsCached = readSquidHttpCache(squidChainsHttpCache, chainsCacheKey);
  if (chainsCached) return chainsCached;

  if (testnet) {
    const registry = getTestnetRegistry();
    const mapped: ChainResponse[] = registry.map((c) => {
      const rpc = c.rpcs.length === 1 ? c.rpcs[0] : undefined;
      const rpcs = c.rpcs.length > 1 ? c.rpcs : undefined;
      return {
        chainId: String(c.id),
        networkName: c.name,
        ...(rpc && { rpc }),
        ...(rpcs && { rpcs }),
        ...(c.explorer && { explorer: c.explorer }),
      };
    });
    mapped.sort((a, b) => parseInt(a.chainId, 10) - parseInt(b.chainId, 10));
    writeSquidHttpCache(squidChainsHttpCache, chainsCacheKey, mapped);
    return mapped;
  }

  const baseUrl = getSquidBaseUrl(false);
  const integratorId = getIntegratorId();
  const response = (await fetch(`${baseUrl}/chains`, {
    headers: {
      "x-integrator-id": integratorId,
      "Content-Type": "application/json",
    },
  })) as FetchResponse;

  if (!response.ok) {
    const responseText = await response.text();
    if (isSquidRateLimitError(responseText) || response.status === 429) {
      const fromCore = await fetchChainsFromCore();
      if (fromCore !== null && fromCore.length > 0) {
        writeSquidHttpCache(squidChainsHttpCache, chainsCacheKey, fromCore);
        return fromCore;
      }
    }
    throw new Error(`Squid chains API error: ${responseText || response.status}`);
  }

  const data = (await response.json()) as ChainsJson;
  const rawChains: SquidChainRaw[] = Array.isArray(data) ? data : (data.chains ?? data.data ?? []);
  const mainnetRegistry = getMainnetRegistry();
  const registryById = new Map(mainnetRegistry.map((c) => [c.id, c]));

  const mapped = rawChains
    .filter(
      (chain): chain is SquidChainRaw & { chainId: string } =>
        Boolean(chain?.chainId ?? chain?.id)
    )
    .map((chain) => {
      const chainId = String(chain.chainId ?? chain.id);
      const idNum = parseInt(chainId, 10);
      const fromSquid = chain.rpcs ?? (chain.rpcUrls ? (Array.isArray(chain.rpcUrls) ? chain.rpcUrls : [chain.rpcUrls]) : []) ?? (chain.rpc ? [chain.rpc] : []);
      const fallbackRpc = getRpcForChainId(chainId);
      const reg = Number.isNaN(idNum) ? undefined : registryById.get(idNum);
      const fromRegistry = reg?.rpcs ?? [];
      const allUrls = mergeRpcUrls(fromSquid, fromRegistry, fallbackRpc ? [fallbackRpc] : []);
      const rpc = allUrls.length === 1 ? allUrls[0] : undefined;
      const rpcs = allUrls.length > 1 ? allUrls : undefined;
      return {
        chainId,
        networkName:
          chain.networkName ??
          chain.chainName ??
          chain.networkIdentifier ??
          reg?.name ??
          chainId,
        chainIconURI: chain.chainIconURI,
        ...(rpc && { rpc }),
        ...(rpcs && { rpcs }),
        ...(reg?.explorer && { explorer: reg.explorer }),
      };
    });

  for (const c of mapped) {
    if (c.chainId === "101" && (c.chainIconURI == null || c.chainIconURI === "")) {
      c.chainIconURI = SOLANA_CHAIN_ICON_FALLBACK;
    }
  }

  const mappedIds = new Set(mapped.map((c) => c.chainId));
  for (const c of mainnetRegistry) {
    const chainId = String(c.id);
    if (mappedIds.has(chainId)) continue;
    const rpc = c.rpcs.length === 1 ? c.rpcs[0] : undefined;
    const rpcs = c.rpcs.length > 1 ? c.rpcs : undefined;
    mapped.push({
      chainId,
      networkName: c.name,
      chainIconURI: chainId === "101" ? SOLANA_CHAIN_ICON_FALLBACK : undefined,
      ...(rpc && { rpc }),
      ...(rpcs && { rpcs }),
      ...(c.explorer && { explorer: c.explorer }),
    });
    mappedIds.add(chainId);
  }

  mapped.sort((a, b) => {
    const idA = parseInt(a.chainId, 10);
    const idB = parseInt(b.chainId, 10);
    if (!Number.isNaN(idA) && !Number.isNaN(idB)) return idA - idB;
    return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
  });
  writeSquidHttpCache(squidChainsHttpCache, chainsCacheKey, mapped);
  return mapped;
}

/** Returns mainnet + testnet chains in one list (Squid + data/chains). */
export async function fetchChainsAll(): Promise<ChainResponse[]> {
  const [mainnet, testnet] = await Promise.all([
    fetchChains(false),
    fetchChains(true),
  ]);
  return [...mainnet, ...testnet];
}

export async function fetchTokens(testnet: boolean): Promise<TokenResponse[]> {
  const tokensCacheKey = testnet ? "tokens-testnet" : "tokens-mainnet";
  const tokensCached = readSquidHttpCache(squidTokensHttpCache, tokensCacheKey);
  if (tokensCached) return tokensCached;

  const inflight = squidTokensInflight.get(tokensCacheKey);
  if (inflight) return inflight;

  const run = (async (): Promise<TokenResponse[]> => {
    const stale = readSquidHttpCacheStale(squidTokensHttpCache, tokensCacheKey);

    const integratorId = getIntegratorId();
    const baseUrl = getSquidBaseUrl(testnet);

  const chainIdToNetworkName = new Map<string, string>();
  const chainIdToIconUri = new Map<string, string>();
  const chainIdToRpc = new Map<string, string | undefined>();
  const chainIdToRpcs = new Map<string, string[] | undefined>();

  if (testnet) {
    const registry = getTestnetRegistry();
    for (const c of registry) {
      const chainId = String(c.id);
      chainIdToNetworkName.set(chainId, c.name);
      if (c.rpcs.length === 1) chainIdToRpc.set(chainId, c.rpcs[0]);
      else if (c.rpcs.length > 1) chainIdToRpcs.set(chainId, c.rpcs);
    }
    const fileTokens = loadTokenListTokens("testnet.tokens.json");
    const testnetMapped: TokenResponse[] = fileTokens
      .filter(
        (t): t is TokenListFileEntry & { chainId: number; address: string } =>
          typeof t.chainId === "number" && typeof t.address === "string" && t.address.length > 0
      )
      .map((t) => {
        const cid = String(t.chainId);
        return {
          chainId: cid,
          networkName: chainIdToNetworkName.get(cid) ?? cid,
          chainIconURI: undefined,
          address: String(t.address),
          symbol: t.symbol ?? "—",
          decimals: Number(t.decimals) ?? 18,
          name: t.name,
          logoURI: t.logoURI,
          ...(chainIdToRpc.get(cid) && { rpc: chainIdToRpc.get(cid) }),
          ...(chainIdToRpcs.get(cid) && { rpcs: chainIdToRpcs.get(cid) }),
        };
      });
    testnetMapped.sort((a, b) => {
      const idCompare = parseInt(a.chainId, 10) - parseInt(b.chainId, 10);
      if (!Number.isNaN(idCompare) && idCompare !== 0) return idCompare;
      if (a.chainId !== b.chainId) return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
      return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
    });
    writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, testnetMapped);
    return testnetMapped;
  }

  const tokensResponse = (await fetch(`${baseUrl}/tokens`, {
    headers: {
      "x-integrator-id": integratorId,
      "Content-Type": "application/json",
    },
  })) as FetchResponse;

  if (!tokensResponse.ok) {
    const responseText = await tokensResponse.text();
    if (isSquidRateLimitError(responseText) || tokensResponse.status === 429) {
      if (stale && stale.length > 0) return stale;
      const fromFile = loadMainnetTokensFromFileFallback();
      if (fromFile.length > 0) {
        writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, fromFile);
        return fromFile;
      }
      const fromCore = await fetchTokensFromCore();
      if (fromCore !== null && fromCore.length > 0) {
        writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, fromCore);
        return fromCore;
      }
    }
    throw new Error(`Squid tokens API error: ${responseText || tokensResponse.status}`);
  }

  const tokensData = (await tokensResponse.json()) as TokensJson;
  const rawTokens: SquidTokenRaw[] = Array.isArray(tokensData)
    ? tokensData
    : (tokensData.tokens ?? tokensData.data ?? []);

  if (!testnet) {
    const chainsResponse = (await fetch(`${baseUrl}/chains`, {
      headers: {
        "x-integrator-id": integratorId,
        "Content-Type": "application/json",
      },
    })) as FetchResponse;
    if (!chainsResponse.ok) {
      const responseText = await chainsResponse.text();
      if (isSquidRateLimitError(responseText) || chainsResponse.status === 429) {
        if (stale && stale.length > 0) return stale;
        const fromFile = loadMainnetTokensFromFileFallback();
        if (fromFile.length > 0) {
          writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, fromFile);
          return fromFile;
        }
        const fromCore = await fetchTokensFromCore();
        if (fromCore !== null && fromCore.length > 0) {
          writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, fromCore);
          return fromCore;
        }
      }
      throw new Error(`Squid chains API error: ${responseText || chainsResponse.status}`);
    }
    const chainsData = (await chainsResponse.json()) as ChainsJson;
    const rawChains: SquidChainRaw[] = Array.isArray(chainsData)
      ? chainsData
      : (chainsData.chains ?? chainsData.data ?? []);
    const mainnetRegistry = getMainnetRegistry();
    const registryById = new Map(mainnetRegistry.map((c) => [c.id, c]));
    for (const chain of rawChains) {
      const chainId = String(chain.chainId ?? chain.id ?? "");
      if (chainId) {
        const idNum = parseInt(chainId, 10);
        const reg = Number.isNaN(idNum) ? undefined : registryById.get(idNum);
        chainIdToNetworkName.set(
          chainId,
          chain.networkName ??
            chain.chainName ??
            chain.networkIdentifier ??
            reg?.name ??
            chainId
        );
        if (chain.chainIconURI) chainIdToIconUri.set(chainId, chain.chainIconURI);
        const fromSquid = chain.rpcs ?? (chain.rpcUrls ? (Array.isArray(chain.rpcUrls) ? chain.rpcUrls : [chain.rpcUrls]) : []) ?? (chain.rpc ? [chain.rpc] : []);
        const fromRegistry = reg?.rpcs ?? [];
        const fallback = getRpcForChainId(chainId);
        const allUrls = mergeRpcUrls(fromSquid, fromRegistry, fallback ? [fallback] : []);
        if (allUrls.length === 1) chainIdToRpc.set(chainId, allUrls[0]);
        else if (allUrls.length > 1) chainIdToRpcs.set(chainId, allUrls);
        else if (fallback) chainIdToRpc.set(chainId, fallback);
      }
    }
    for (const c of mainnetRegistry) {
      const chainId = String(c.id);
      if (!chainIdToNetworkName.has(chainId)) chainIdToNetworkName.set(chainId, c.name);
      if (!chainIdToRpc.has(chainId) && !chainIdToRpcs.has(chainId)) {
        if (c.rpcs.length === 1) chainIdToRpc.set(chainId, c.rpcs[0]);
        else if (c.rpcs.length > 1) chainIdToRpcs.set(chainId, c.rpcs);
      }
    }
    if (!chainIdToIconUri.has("101")) {
      chainIdToIconUri.set("101", SOLANA_CHAIN_ICON_FALLBACK);
    }
  }

  const mapped: TokenResponse[] = [];
  for (const token of rawTokens) {
    if (!token?.chainId || (!token?.address && !token?.symbol)) continue;
    const cid = String(token.chainId);
    const fallbackNative = NATIVE_TOKEN_FALLBACK_BY_CHAIN[cid];
    const resolvedAddress = token.address?.trim() || fallbackNative?.address || "";
    if (!resolvedAddress) continue;
    const resolvedSymbol = token.symbol?.trim() || fallbackNative?.symbol || "—";
    const resolvedName = token.name?.trim() || fallbackNative?.name;
    const resolvedDecimals =
      Number.isFinite(token.decimals) && Number(token.decimals) > 0
        ? Number(token.decimals)
        : fallbackNative?.decimals ?? 18;
    const rpc = chainIdToRpc.get(cid);
    const rpcs = chainIdToRpcs.get(cid);
    const chainIconURI = chainIdToIconUri.get(cid);
    const logoURI =
      typeof token.logoURI === "string" && token.logoURI.trim().length > 0
        ? token.logoURI
        : undefined;
    mapped.push({
      chainId: cid,
      networkName: chainIdToNetworkName.get(cid) ?? cid,
      address: resolvedAddress,
      symbol: resolvedSymbol,
      decimals: resolvedDecimals,
      ...(resolvedName ? { name: resolvedName } : {}),
      ...(chainIconURI ? { chainIconURI } : {}),
      ...(logoURI ? { logoURI } : {}),
      ...(rpc && { rpc }),
      ...(rpcs && { rpcs }),
    });
  }

  const solanaTokens = loadTokenListTokens("mainnet.tokens.json");
  const solanaChainId = "101";
  const solanaRpc = chainIdToRpc.get(solanaChainId);
  const solanaRpcs = chainIdToRpcs.get(solanaChainId);
  const existingKeys = new Set(
    mapped.map(
      (t) => `${t.chainId}:${normalizeAddressForChain(String(t.chainId), t.address)}`
    )
  );
  for (const t of solanaTokens) {
    if (t.chainId !== 101 || !t.address) continue;
    const key = `${solanaChainId}:${normalizeAddressForChain(solanaChainId, String(t.address))}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    mapped.push({
      chainId: solanaChainId,
      networkName: chainIdToNetworkName.get(solanaChainId) ?? "Solana",
      address: String(t.address),
      symbol: t.symbol ?? "—",
      decimals: Number.isFinite(t.decimals) ? Number(t.decimals) : 18,
      ...(t.name ? { name: t.name } : {}),
      ...((t.logoURI ?? "").trim() ? { logoURI: t.logoURI } : {}),
      ...(chainIdToIconUri.get(solanaChainId) ?? SOLANA_CHAIN_ICON_FALLBACK
        ? { chainIconURI: chainIdToIconUri.get(solanaChainId) ?? SOLANA_CHAIN_ICON_FALLBACK }
        : {}),
      ...(solanaRpc && { rpc: solanaRpc }),
      ...(solanaRpcs && { rpcs: solanaRpcs }),
    });
  }

  for (const row of mapped) {
    if (row.chainId === "101" && (row.chainIconURI == null || row.chainIconURI === "")) {
      row.chainIconURI = SOLANA_CHAIN_ICON_FALLBACK;
    }
  }

  const knownChains = new Set(mapped.map((token) => token.chainId));
  for (const [chainId, fallback] of Object.entries(
    NATIVE_TOKEN_FALLBACK_BY_CHAIN
  )) {
    if (mapped.some((token) => token.chainId === chainId)) continue;
    if (!knownChains.has(chainId) && !chainIdToNetworkName.has(chainId)) continue;
    mapped.push({
      chainId,
      networkName:
        chainIdToNetworkName.get(chainId) ?? fallback.name.replace(" Lumens", ""),
      address: fallback.address,
      symbol: fallback.symbol,
      decimals: fallback.decimals,
      name: fallback.name,
      ...(chainIdToIconUri.get(chainId)
        ? { chainIconURI: chainIdToIconUri.get(chainId) }
        : {}),
      ...(chainIdToRpc.get(chainId) && { rpc: chainIdToRpc.get(chainId) }),
      ...(chainIdToRpcs.get(chainId) && { rpcs: chainIdToRpcs.get(chainId) }),
    });
  }

  mapped.sort((a, b) => {
    const idCompare = parseInt(a.chainId, 10) - parseInt(b.chainId, 10);
    if (!Number.isNaN(idCompare) && idCompare !== 0) return idCompare;
    if (a.chainId !== b.chainId) return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
    return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
  });
  writeSquidHttpCache(squidTokensHttpCache, tokensCacheKey, mapped);
  return mapped;
  })();

  squidTokensInflight.set(tokensCacheKey, run);
  try {
    return await run;
  } finally {
    squidTokensInflight.delete(tokensCacheKey);
  }
}

/** Returns mainnet + testnet tokens in one list (Squid + Solana + data/tokens). */
export async function fetchTokensAll(): Promise<TokenResponse[]> {
  const [mainnet, testnet] = await Promise.all([
    fetchTokens(false),
    fetchTokens(true),
  ]);
  return [...mainnet, ...testnet];
}

/** Filter cached chain list by exact chainId (string match). */
export function filterChainsByChainId(
  chains: ChainResponse[],
  chainId: string | undefined
): ChainResponse[] {
  const id = chainId?.trim();
  if (!id) return chains;
  return chains.filter((c) => String(c.chainId) === id);
}

/** Filter cached token list by chainId and/or token contract address. */
export function filterTokensByQuery(
  tokens: TokenResponse[],
  opts: { chainId?: string; address?: string }
): TokenResponse[] {
  let out = tokens;
  const cid = opts.chainId?.trim();
  if (cid) {
    out = out.filter((t) => String(t.chainId) === cid);
  }
  const addr = opts.address?.trim();
  if (addr) {
    out = out.filter(
      (t) => normalizeAddressForChain(String(t.chainId), t.address) === normalizeAddressForChain(String(t.chainId), addr)
    );
  }
  return out;
}

export async function fetchBalancesMulticall(
  walletAddress: string,
  options: {
    chainId?: string;
    tokenAddress?: string;
    networkIds?: number[];
    tokenAddresses?: string[];
    testnet?: boolean;
  }
): Promise<BalanceItem[]> {
  const chains = await fetchChains(Boolean(options.testnet));
  const tokens = await fetchTokens(Boolean(options.testnet));
  const hasNetworkIds = Array.isArray(options.networkIds) && options.networkIds.length > 0;
  const hasTokenAddresses =
    Array.isArray(options.tokenAddresses) && options.tokenAddresses.length > 0;
  const isBroadScan =
    !options.chainId && !options.tokenAddress && !hasNetworkIds && !hasTokenAddresses;

  let tokensToFetch = tokens;
  if (hasNetworkIds) {
    const wantedChainIds = new Set(options.networkIds!.map((id) => String(id)));
    tokensToFetch = tokensToFetch.filter((token) => wantedChainIds.has(String(token.chainId)));
  }
  if (hasTokenAddresses) {
    const requestedTokenAddresses = options.tokenAddresses!
      .map((address) => address.trim())
      .filter((address) => address.length > 0);
    tokensToFetch = tokensToFetch.filter((token) =>
      requestedTokenAddresses.some(
        (requestedAddress) =>
          normalizeAddressForChain(String(token.chainId), requestedAddress) ===
          normalizeAddressForChain(String(token.chainId), token.address)
      )
    );
  }
  if (options.chainId) {
    tokensToFetch = tokensToFetch.filter(
      (token) => String(token.chainId) === String(options.chainId)
    );
  }
  if (options.tokenAddress) {
    const rawTokenAddress = options.tokenAddress.trim();
    tokensToFetch = tokensToFetch.filter(
      (token) =>
        normalizeAddressForChain(String(token.chainId), token.address) ===
        normalizeAddressForChain(String(token.chainId), rawTokenAddress)
    );
  }

  if (isBroadScan) {
    tokensToFetch = tokensToFetch.filter((token) =>
      BALANCE_CHAIN_ALLOWLIST.has(String(token.chainId))
    );
  }

  let evmChains = chains.filter((chain) => getRpcUrlsForChain(chain).length > 0);
  if (isBroadScan) {
    evmChains = evmChains
      .filter((chain) => BALANCE_CHAIN_ALLOWLIST.has(String(chain.chainId)))
      .slice(0, MAX_BALANCE_CHAINS);
  }

  const results: BalanceItem[] = [];
  const walletAddressTyped = walletAddress as `0x${string}`;

  for (const chain of evmChains) {
    const rpcUrls = getRpcUrlsForChain(chain);
    let tokensOnChain = tokensToFetch.filter(
      (token) => String(token.chainId) === String(chain.chainId)
    );
    if (isBroadScan && tokensOnChain.length > MAX_BALANCE_TOKENS_PER_CHAIN) {
      tokensOnChain = [...tokensOnChain]
        .sort((a, b) => tokenBalancePriority(b) - tokenBalancePriority(a))
        .slice(0, MAX_BALANCE_TOKENS_PER_CHAIN);
    }
    const erc20Tokens = tokensOnChain.filter(
      (token) =>
        token.address &&
        token.address !== "0x0000000000000000000000000000000000000000" &&
        token.address.toLowerCase() !== "native"
    );

    const chainIdNum = parseInt(chain.chainId, 10);
    if (Number.isNaN(chainIdNum)) continue;

    const nativeAddress =
      "0x0000000000000000000000000000000000000000" as `0x${string}`;
    const hasNative = tokensOnChain.some(
      (token) =>
        !token.address ||
        token.address === "0x0000000000000000000000000000000000000000" ||
        token.address.toLowerCase() === "native"
    );

    let chainSucceeded = false;
    for (const rpcUrl of rpcUrls) {
      if (chainSucceeded) break;
      try {
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
          transport: http(rpcUrl, { timeout: BALANCE_SCAN_RPC_TIMEOUT_MS }),
        });

        if (hasNative) {
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
        }

        if (erc20Tokens.length > 0) {
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
        }

        chainSucceeded = true;
      } catch {
        // try next RPC
      }
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

async function fetchBalancesFromSquidApi(
  walletAddress: string,
  options: {
    chainId?: string;
    tokenAddress?: string;
    networkIds?: number[];
    tokenAddresses?: string[];
    testnet?: boolean;
  }
): Promise<BalanceItem[]> {
  const baseUrl = getSquidBaseUrl(Boolean(options.testnet));
  const query = new URLSearchParams();
  query.set("address", walletAddress.trim());
  if (options.chainId) query.set("chainId", options.chainId);
  if (options.tokenAddress) query.set("tokenAddress", options.tokenAddress);
  if (options.networkIds && options.networkIds.length > 0) {
    query.set("networkIds", options.networkIds.map((id) => String(id)).join(","));
  }
  if (options.tokenAddresses && options.tokenAddresses.length > 0) {
    query.set("tokenAddresses", options.tokenAddresses.join(","));
  }
  const integratorId = getIntegratorId();
  const response = (await fetch(`${baseUrl}/balances?${query.toString()}`, {
    headers: {
      "x-integrator-id": integratorId,
      "Content-Type": "application/json",
    },
  })) as FetchResponse;
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as unknown;
  const rawRows: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const rows: BalanceItem[] = [];
  for (const row of rawRows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<BalanceItem>;
    const chainId = typeof item.chainId === "string" ? item.chainId.trim() : "";
    const tokenAddress = typeof item.tokenAddress === "string" ? item.tokenAddress.trim() : "";
    const balance = typeof item.balance === "string" ? item.balance : "0";
    const balanceRaw = typeof item.balanceRaw === "string" ? item.balanceRaw : "0";
    const tokenSymbol = typeof item.tokenSymbol === "string" ? item.tokenSymbol : "";
    if (!chainId || !tokenAddress || !tokenSymbol) continue;
    rows.push({
      chainId,
      networkName: typeof item.networkName === "string" ? item.networkName : chainId,
      chainIconURI:
        typeof item.chainIconURI === "string" ? item.chainIconURI : undefined,
      tokenAddress,
      tokenSymbol,
      tokenDecimals: Number.isFinite(item.tokenDecimals) ? Number(item.tokenDecimals) : 18,
      tokenName: typeof item.tokenName === "string" ? item.tokenName : undefined,
      tokenLogoURI:
        typeof item.tokenLogoURI === "string" ? item.tokenLogoURI : undefined,
      balance,
      balanceRaw,
    });
  }
  return rows;
}

export async function fetchBalancesFromSquid(
  walletAddress: string,
  options: {
    chainId?: string;
    tokenAddress?: string;
    networkIds?: number[];
    tokenAddresses?: string[];
    testnet?: boolean;
  }
): Promise<BalanceItem[]> {
  const cacheKey = [
    walletAddress.trim().toLowerCase(),
    options.chainId?.trim() ?? "",
    options.tokenAddress?.trim() ?? "",
    options.networkIds?.map((id) => String(id)).sort().join(",") ?? "",
    options.tokenAddresses?.map((address) => address.trim()).sort().join(",") ?? "",
    options.testnet ? "1" : "0",
  ].join("|");
  const cached = readBalanceCache(cacheKey);
  if (cached) return cached;

  const inFlight = squidBalancesInflight.get(cacheKey);
  if (inFlight) return inFlight;

  const run = Promise.all([
    fetchBalancesFromSquidApi(walletAddress, {
      chainId: options.chainId,
      tokenAddress: options.tokenAddress,
      networkIds: options.networkIds,
      tokenAddresses: options.tokenAddresses,
      testnet: options.testnet,
    }),
    fetchBalancesMulticall(walletAddress, {
      chainId: options.chainId,
      tokenAddress: options.tokenAddress,
      networkIds: options.networkIds,
      tokenAddresses: options.tokenAddresses,
      testnet: options.testnet,
    }),
  ])
    .then(([squidBalances, multicallBalances]) => {
      const merged = mergeBalanceSources(
        mapSource(squidBalances, "squid"),
        mapSource(multicallBalances, "multicall")
      ).filter((item) => toBalanceNumber(item.balance) > 0);
      merged.sort((first, second) => {
        const firstValue = toBalanceNumber(first.balance);
        const secondValue = toBalanceNumber(second.balance);
        return secondValue - firstValue;
      });
      writeSquidHttpCache(squidBalancesCache, cacheKey, merged);
      return merged;
    })
    .catch((error) => {
      const stale = readSquidHttpCacheStale(squidBalancesCache, cacheKey);
      if (stale) return stale;
      throw error;
    });

  squidBalancesInflight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    squidBalancesInflight.delete(cacheKey);
  }
}
