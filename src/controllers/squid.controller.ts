import type { FastifyReply, FastifyRequest } from "fastify";
import {
  fetchChains,
  fetchChainsAll,
  fetchTokens,
  fetchTokensAll,
  fetchBalancesFromSquid,
  filterChainsByChainId,
  filterTokensByQuery,
} from "../services/squid.service.js";

function readChainIdQuery(request: FastifyRequest): string | undefined {
  const q = request.query as Record<string, unknown>;
  const v = q.chainId;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function readTokenAddressQuery(request: FastifyRequest): string | undefined {
  const q = request.query as Record<string, unknown>;
  const a = q.address;
  const t = q.tokenAddress;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof t === "string" && t.trim()) return t.trim();
  return undefined;
}

function queryBool(q: Record<string, unknown>, key: string): boolean {
  const v = q[key];
  return v === "1" || v === "true";
}

/**
 * GET /api/squid/chains
 */
export async function getChains(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const q = request.query as Record<string, unknown>;
    const chainId = readChainIdQuery(request);
    const all = queryBool(q, "all");
    if (all) {
      let chains = await fetchChainsAll();
      chains = filterChainsByChainId(chains, chainId);
      void reply.header("x-squid-network", "all");
      void reply.send(chains);
      return;
    }
    const testnet = queryBool(q, "testnet");
    let chains = await fetchChains(testnet);
    chains = filterChainsByChainId(chains, chainId);
    void reply.header("x-squid-network", testnet ? "testnet" : "mainnet");
    void reply.send(chains);
  } catch (error) {
    console.error("[Squid] chains error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch chains.";
    void reply.status(503).send({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/squid/tokens
 */
export async function getTokens(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const q = request.query as Record<string, unknown>;
    const chainId = readChainIdQuery(request);
    const address = readTokenAddressQuery(request);
    const all = queryBool(q, "all");
    if (all) {
      let tokens = await fetchTokensAll();
      tokens = filterTokensByQuery(tokens, { chainId, address });
      void reply.header("x-squid-network", "all");
      void reply.send(tokens);
      return;
    }
    const testnet = queryBool(q, "testnet");
    let tokens = await fetchTokens(testnet);
    tokens = filterTokensByQuery(tokens, { chainId, address });
    void reply.header("x-squid-network", testnet ? "testnet" : "mainnet");
    void reply.send(tokens);
  } catch (error) {
    console.error("[Squid] tokens error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch tokens.";
    void reply.status(503).send({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/squid/balances
 */
export async function getBalances(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const q = request.query as Record<string, unknown>;
    const address = typeof q.address === "string" ? q.address.trim() : "";
    if (!address) {
      void reply.status(400).send({
        success: false,
        error: "address is required (wallet address).",
      });
      return;
    }

    const chainId = typeof q.chainId === "string" ? q.chainId.trim() : undefined;
    const tokenAddress =
      typeof q.tokenAddress === "string" ? q.tokenAddress.trim() : undefined;
    const testnet = queryBool(q, "testnet");
    const networkIds =
      typeof q.networkIds === "string"
        ? q.networkIds
            .split(",")
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((id) => Number.isFinite(id))
        : [];
    const tokenAddresses =
      typeof q.tokenAddresses === "string"
        ? q.tokenAddresses
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        : [];

    const balances = await fetchBalancesFromSquid(address, {
      chainId: chainId || undefined,
      tokenAddress: tokenAddress || undefined,
      networkIds: networkIds.length > 0 ? networkIds : undefined,
      tokenAddresses: tokenAddresses.length > 0 ? tokenAddresses : undefined,
      testnet,
    });

    void reply.header("x-squid-network", testnet ? "testnet" : "mainnet");
    void reply.send({ success: true, data: balances });
  } catch (error) {
    console.error("[Squid] balances error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch balances.";
    void reply.status(502).send({
      success: false,
      error: message,
    });
  }
}
