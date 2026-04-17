import type { FastifyReply, FastifyRequest } from "fastify";
import { getAddressForEnsName, getEnsNameForAddress, isEthAddress } from "../services/ens.service.js";

/**
 * GET /name/:address — resolve wallet address to ENS name (and avatar when available).
 */
export async function getNameByAddress(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const address = ((req.params as { address?: string }).address ?? "").trim();
    if (!address) {
      void reply.status(400).send({ success: false, error: "Address is required." });
      return;
    }
    if (!isEthAddress(address)) {
      void reply.status(400).send({ success: false, error: "Invalid Ethereum address." });
      return;
    }

    const result = await getEnsNameForAddress(address);
    void reply.send({
      success: true,
      ensName: result.ensName,
      avatar: result.avatar ?? null,
    });
  } catch (err) {
    console.error("[ENS] getEnsName error", err);
    void reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : "Failed to resolve ENS name.",
    });
  }
}

/**
 * GET /address?ens-name=... — resolve ENS name to wallet address (and avatar when available).
 */
export async function getAddressByEnsName(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const q = req.query as Record<string, unknown>;
    const ensName = String(q["ens-name"] ?? q.ensName ?? "")
      .trim();
    if (!ensName) {
      void reply.status(400).send({ success: false, error: "ens-name query is required." });
      return;
    }

    const result = await getAddressForEnsName(ensName);
    void reply.send({
      success: true,
      address: result.address,
      avatar: result.avatar ?? null,
    });
  } catch (err) {
    console.error("[ENS] getAddress error", err);
    void reply.status(500).send({
      success: false,
      error: err instanceof Error ? err.message : "Failed to resolve address.",
    });
  }
}
