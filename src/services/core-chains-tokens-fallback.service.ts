/**
 * When Squid Router returns HTTP 429 / RATE_LIMIT, load chains and tokens from the Core API
 * (Prisma Chain + SupportedToken) so the Morapay backend keeps serving UI data.
 */

import type { ChainResponse, TokenResponse } from "../lib/interfaces/squid.types.js";
import { getRpcForChainId } from "../lib/constants/evm-rpc.js";

export const SOLANA_CHAIN_ICON_FALLBACK =
  "https://assets.coingecko.com/coins/images/4128/small/solana.png";

function getCoreApiBaseUrl(): string | null {
  const u =
    process.env.CORE_API_URL?.trim() ??
    process.env.MORAPAY_CORE_API_URL?.trim() ??
    process.env.NEXT_PUBLIC_CORE_API_URL?.trim() ??
    "";
  return u.length > 0 ? u.replace(/\/$/, "") : null;
}

export function isSquidRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("too many") ||
    m.includes("rate_limit") ||
    m.includes("rate limit") ||
    m.includes("429")
  );
}

type CoreChainsEnvelope = {
  success?: boolean;
  data?: {
    chains?: Array<{
      chainId: string;
      name: string;
      chainIconURI?: string;
      rpc?: string;
      rpcUrls?: string[] | unknown;
    }>;
  };
};

type CoreTokensEnvelope = {
  success?: boolean;
  data?: {
    tokens?: Array<{
      chainId: string;
      networkName?: string;
      chainIconURI?: string;
      address: string;
      symbol: string;
      decimals: number;
      name?: string;
      logoURI?: string;
    }>;
  };
};

/** Map Core GET /api/chains to backend ChainResponse[]. */
export async function fetchChainsFromCore(): Promise<ChainResponse[] | null> {
  const base = getCoreApiBaseUrl();
  if (!base) return null;

  const res = (await fetch(`${base}/api/chains`, {
    headers: { Accept: "application/json" },
  })) as { ok: boolean; json(): Promise<unknown> };

  if (!res.ok) return null;
  const body = (await res.json()) as CoreChainsEnvelope;
  if (!body.success || !Array.isArray(body.data?.chains)) return null;

  const out: ChainResponse[] = body.data!.chains!.map((c) => {
    const chainId = String(c.chainId);
    const rpcFallback = getRpcForChainId(chainId);
    const rpcUrls = Array.isArray(c.rpcUrls) ? c.rpcUrls.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
    const rpcSingle = c.rpc?.trim() || (rpcUrls.length === 1 ? rpcUrls[0] : undefined);
    const rpcMulti = rpcUrls.length > 1 ? rpcUrls : undefined;
    return {
      chainId,
      networkName: c.name,
      chainIconURI:
        c.chainIconURI ??
        (chainId === "101" ? SOLANA_CHAIN_ICON_FALLBACK : undefined),
      ...(rpcSingle ? { rpc: rpcSingle } : rpcFallback ? { rpc: rpcFallback } : {}),
      ...(rpcMulti ? { rpcs: rpcMulti } : {}),
    };
  });
  out.sort((a, b) => parseInt(a.chainId, 10) - parseInt(b.chainId, 10));
  return out;
}

/** Map Core GET /api/tokens to backend TokenResponse[]. */
export async function fetchTokensFromCore(): Promise<TokenResponse[] | null> {
  const base = getCoreApiBaseUrl();
  if (!base) return null;

  const res = (await fetch(`${base}/api/tokens`, {
    headers: { Accept: "application/json" },
  })) as { ok: boolean; json(): Promise<unknown> };

  if (!res.ok) return null;
  const body = (await res.json()) as CoreTokensEnvelope;
  if (!body.success || !Array.isArray(body.data?.tokens)) return null;

  const out: TokenResponse[] = body.data!.tokens!.map((t) => {
    const cid = String(t.chainId);
    return {
      chainId: cid,
      networkName: t.networkName ?? cid,
      chainIconURI:
        t.chainIconURI ?? (cid === "101" ? SOLANA_CHAIN_ICON_FALLBACK : undefined),
      address: t.address,
      symbol: t.symbol,
      decimals: Number(t.decimals) || 18,
      name: t.name,
      logoURI: t.logoURI,
    };
  });
  out.sort((a, b) => {
    const idCompare = parseInt(a.chainId, 10) - parseInt(b.chainId, 10);
    if (!Number.isNaN(idCompare) && idCompare !== 0) return idCompare;
    if (a.chainId !== b.chainId) return a.chainId.localeCompare(b.chainId, undefined, { numeric: true });
    return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: "base" });
  });
  for (const row of out) {
    if (row.chainId === "101" && (row.chainIconURI == null || row.chainIconURI === "")) {
      row.chainIconURI = SOLANA_CHAIN_ICON_FALLBACK;
    }
  }
  return out;
}
