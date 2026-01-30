import type { Request, Response } from "express";
import {
  fetchChains,
  fetchTokens,
  fetchBalancesFromSquid,
} from "../services/squid.service.js";

/**
 * GET /api/squid/chains
 * Query: testnet (optional, "1" or "true" for testnet).
 */
export async function getChains(request: Request, response: Response): Promise<void> {
  try {
    const testnet =
      request.query.testnet === "1" || request.query.testnet === "true";
    const chains = await fetchChains(testnet);
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
 * Query: testnet (optional, "1" or "true" for testnet).
 */
export async function getTokens(request: Request, response: Response): Promise<void> {
  try {
    const testnet =
      request.query.testnet === "1" || request.query.testnet === "true";
    const tokens = await fetchTokens(testnet);
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
 * Query: address (required), chainId (optional), tokenAddress (optional), testnet (optional, "1" or "true").
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

    const balances = await fetchBalancesFromSquid(address, {
      chainId: chainId || undefined,
      tokenAddress: tokenAddress || undefined,
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
