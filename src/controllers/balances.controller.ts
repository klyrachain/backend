import type { Request, Response } from "express";
import { fetchBalancesMulticall } from "../services/squid.service.js";

/**
 * GET /api/balances/multicall
 * Query: address (required), chainId (optional), tokenAddress (optional), testnet (optional, "1" or "true").
 * Returns token balances via viem multicall, sorted by balance (highest first).
 */
export async function getMulticallBalances(
  request: Request,
  response: Response
): Promise<void> {
  try {
    const walletAddress =
      typeof request.query.address === "string" ? request.query.address.trim() : "";
    if (!walletAddress) {
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

    const balances = await fetchBalancesMulticall(walletAddress, {
      chainId: chainId || undefined,
      tokenAddress: tokenAddress || undefined,
      testnet,
    });

    response.json({ success: true, data: balances });
  } catch (error) {
    console.error("[Balances] multicall error", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch multicall balances.";
    response.status(502).json({
      success: false,
      error: message,
    });
  }
}
