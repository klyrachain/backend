import type { Request, Response } from "express";
import {
  fetchChains,
  fetchChainsAll,
  fetchTokens,
  fetchTokensAll,
  fetchBalancesFromSquid,
  filterChainsByChainId,
  filterTokensByQuery,
} from "../services/squid.service.js";

function readChainIdQuery(request: Request): string | undefined {
  const q = request.query.chainId;
  return typeof q === "string" && q.trim() ? q.trim() : undefined;
}

function readTokenAddressQuery(request: Request): string | undefined {
  const a = request.query.address;
  const t = request.query.tokenAddress;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof t === "string" && t.trim()) return t.trim();
  return undefined;
}

/**
 * GET /api/squid/chains
 * Query: testnet (optional, "1" or "true" for testnet only).
 *        all (optional, "1" or "true") = mainnet + testnet combined (Squid + data/chains).
 *        chainId (optional) = return only the chain with this id (string match).
 */
export async function getChains(request: Request, response: Response): Promise<void> {
  try {
    const chainId = readChainIdQuery(request);
    const all = request.query.all === "1" || request.query.all === "true";
    if (all) {
      let chains = await fetchChainsAll();
      chains = filterChainsByChainId(chains, chainId);
      response.setHeader("x-squid-network", "all");
      response.json(chains);
      return;
    }
    const testnet =
      request.query.testnet === "1" || request.query.testnet === "true";
    let chains = await fetchChains(testnet);
    chains = filterChainsByChainId(chains, chainId);
    response.setHeader("x-squid-network", testnet ? "testnet" : "mainnet");
    response.json(chains);
  } catch (error) {
    console.error("[Squid] chains error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch chains.";
    response.status(503).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/squid/tokens
 * Query: testnet (optional, "1" or "true" for testnet only).
 *        all (optional, "1" or "true") = mainnet + testnet combined (Squid + Solana + data/tokens).
 *        chainId (optional) = only tokens on this chain.
 *        address or tokenAddress (optional) = only this token contract (case-insensitive match).
 */
export async function getTokens(request: Request, response: Response): Promise<void> {
  try {
    const chainId = readChainIdQuery(request);
    const address = readTokenAddressQuery(request);
    const all = request.query.all === "1" || request.query.all === "true";
    if (all) {
      let tokens = await fetchTokensAll();
      tokens = filterTokensByQuery(tokens, { chainId, address });
      response.setHeader("x-squid-network", "all");
      response.json(tokens);
      return;
    }
    const testnet =
      request.query.testnet === "1" || request.query.testnet === "true";
    let tokens = await fetchTokens(testnet);
    tokens = filterTokensByQuery(tokens, { chainId, address });
    response.setHeader("x-squid-network", testnet ? "testnet" : "mainnet");
    response.json(tokens);
  } catch (error) {
    console.error("[Squid] tokens error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch tokens.";
    response.status(503).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/squid/balances
 * Query: address (required), chainId/tokenAddress/networkIds/tokenAddresses/testnet (all optional).
 * Behavior: wallet-wide by default, returns merged non-duplicate balances from Squid + multicall.
 */
export async function getBalances(request: Request, response: Response): Promise<void> {
  try {
    const address = typeof request.query.address === "string" ? request.query.address.trim() : "";
    if (!address) {
      response.status(400).json({
        success: false,
        error: "address is required (wallet address).",
      });
      return;
    }

    const chainId =
      typeof request.query.chainId === "string" ? request.query.chainId.trim() : undefined;
    const tokenAddress =
      typeof request.query.tokenAddress === "string"
        ? request.query.tokenAddress.trim()
        : undefined;
    const testnet =
      request.query.testnet === "1" || request.query.testnet === "true";
    const networkIds =
      typeof request.query.networkIds === "string"
        ? request.query.networkIds
            .split(",")
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((id) => Number.isFinite(id))
        : [];
    const tokenAddresses =
      typeof request.query.tokenAddresses === "string"
        ? request.query.tokenAddresses
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

    response.setHeader("x-squid-network", testnet ? "testnet" : "mainnet");
    response.json({ success: true, data: balances });
  } catch (error) {
    console.error("[Squid] balances error", error);
    const message = error instanceof Error ? error.message : "Failed to fetch balances.";
    response.status(502).json({
      success: false,
      error: message,
    });
  }
}
