import type { FastifyReply, FastifyRequest } from "fastify";
import { fetchBalancesMulticall } from "../services/squid.service.js";

/**
 * GET /api/balances/multicall
 */
export async function getMulticallBalances(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const q = request.query as Record<string, unknown>;
    const walletAddress = typeof q.address === "string" ? q.address.trim() : "";
    if (!walletAddress) {
      void reply.status(400).send({
        success: false,
        error: "address is required (wallet address).",
      });
      return;
    }

    const chainId = typeof q.chainId === "string" ? q.chainId.trim() : undefined;
    const tokenAddress =
      typeof q.tokenAddress === "string" ? q.tokenAddress.trim() : undefined;
    const testnet = q.testnet === "1" || q.testnet === "true";

    const balances = await fetchBalancesMulticall(walletAddress, {
      chainId: chainId || undefined,
      tokenAddress: tokenAddress || undefined,
      testnet,
    });

    void reply.send({ success: true, data: balances });
  } catch (error) {
    console.error("[Balances] multicall error", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch multicall balances.";
    void reply.status(502).send({
      success: false,
      error: message,
    });
  }
}
