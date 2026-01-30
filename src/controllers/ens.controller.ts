import type { Request, Response } from "express";
import { getAddressForEnsName, getEnsNameForAddress, isEthAddress } from "../services/ens.service.js";

/**
 * GET /name/:address — resolve wallet address to ENS name (and avatar when available).
 */
export async function getNameByAddress(req: Request, res: Response): Promise<void> {
  try {
    const address = (req.params.address ?? "").trim();
    if (!address) {
      res.status(400).json({ success: false, error: "Address is required." });
      return;
    }
    if (!isEthAddress(address)) {
      res.status(400).json({ success: false, error: "Invalid Ethereum address." });
      return;
    }

    const result = await getEnsNameForAddress(address);
    res.json({
      success: true,
      ensName: result.ensName,
      avatar: result.avatar ?? null,
    });
  } catch (err) {
    console.error("[ENS] getEnsName error", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to resolve ENS name.",
    });
  }
}

/**
 * GET /address?ens-name=... — resolve ENS name to wallet address (and avatar when available).
 */
export async function getAddressByEnsName(req: Request, res: Response): Promise<void> {
  try {
    const ensName = (req.query["ens-name"] ?? req.query.ensName ?? "").toString().trim();
    if (!ensName) {
      res.status(400).json({ success: false, error: "ens-name query is required." });
      return;
    }

    const result = await getAddressForEnsName(ensName);
    res.json({
      success: true,
      address: result.address,
      avatar: result.avatar ?? null,
    });
  } catch (err) {
    console.error("[ENS] getAddress error", err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to resolve address.",
    });
  }
}
