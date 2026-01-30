import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet, base } from "viem/chains";
import { normalize } from "viem/ens";
import type { EnsAddressResponse, EnsNameResponse } from "../lib/interfaces/ens.types.js";

const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const baseClient = createPublicClient({
  chain: base,
  transport: http(),
});

const COIN_TYPES: Record<string, number> = {
  eth: 60,
  btc: 0,
  ltc: 2,
  doge: 3,
  dash: 5,
  bch: 145,
  bnb: 714,
  sol: 501,
  matic: 966,
  trx: 195,
  ada: 1815,
  xrp: 144,
  atom: 118,
  dot: 354,
};

function normalizeAddress(raw: string): `0x${string}` | null {
  try {
    if (!raw || typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed.startsWith("0x") || trimmed.length !== 42) return null;
    return getAddress(trimmed) as `0x${string}`;
  } catch {
    return null;
  }
}

async function resolveNameViaAPI(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.ensdata.net/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: string };
    return data?.address ?? null;
  } catch {
    return null;
  }
}

async function resolveAddressViaAPI(address: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.ensdata.net/address/${encodeURIComponent(address)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string; ensName?: string; domain?: string };
    const name = data?.name ?? data?.ensName ?? data?.domain ?? null;
    if (name) return name;
  } catch {}
  try {
    const res = await fetch(`https://api.alpha.ensnode.io/address/${encodeURIComponent(address)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return data?.name ?? null;
  } catch {
    return null;
  }
}

async function getAvatarViaAPI(nameOrAddress: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.ensdata.net/${encodeURIComponent(nameOrAddress)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { avatar_small?: string; avatar?: string };
    return data?.avatar_small ?? data?.avatar ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a wallet address to ENS name (and avatar when available).
 * Tries mainnet ENS, then Base basename, then ENSData API.
 */
export async function getEnsNameForAddress(address: string): Promise<EnsNameResponse> {
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return { ensName: null };
  }

  let ensName: string | null = null;
  let avatar: string | null = null;

  try {
    ensName = await mainnetClient.getEnsName({ address: normalized });
    if (!ensName) ensName = await baseClient.getEnsName({ address: normalized });
    if (!ensName) ensName = await resolveAddressViaAPI(normalized);

    if (ensName) {
      try {
        const n = normalize(ensName);
        avatar = await mainnetClient.getEnsAvatar({ name: n });
        if (!avatar) avatar = await baseClient.getEnsAvatar({ name: n });
        if (!avatar) avatar = await getAvatarViaAPI(ensName);
      } catch {
        avatar = await getAvatarViaAPI(ensName);
      }
    }
  } catch {
    ensName = await resolveAddressViaAPI(normalized);
    if (ensName) avatar = await getAvatarViaAPI(ensName);
  }

  return { ensName, avatar: avatar ?? undefined };
}

/**
 * Resolve an ENS name (or Basename) to wallet address (and avatar when available).
 * Supports .eth, .base, and multi-chain format (name.eth:chain). Tries viem then ENSData API.
 */
export async function getAddressForEnsName(ensName: string): Promise<EnsAddressResponse> {
  const trimmed = ensName?.trim();
  if (!trimmed) {
    return { address: null };
  }

  let address: string | null = null;
  let avatar: string | null = null;

  const colonIndex = trimmed.lastIndexOf(":");
  const hasChain = colonIndex !== -1 && trimmed.includes(".eth:");

  try {
    if (hasChain) {
      const baseName = trimmed.substring(0, colonIndex);
      const chain = trimmed.substring(colonIndex + 1).toLowerCase();
      const coinType = COIN_TYPES[chain];
      if (coinType !== undefined) {
        const normalized = normalize(baseName);
        const addr = await mainnetClient.getEnsAddress({
          name: normalized,
          coinType: BigInt(coinType),
        });
        address = addr ?? null;
      }
      if (!address) {
        address = await resolveNameViaAPI(trimmed);
      }
    } else {
      const normalized = normalize(trimmed);
      if (trimmed.endsWith(".base")) {
        address = await baseClient.getEnsAddress({ name: normalized });
      } else {
        address = await mainnetClient.getEnsAddress({ name: normalized });
      }
      if (!address) {
        address = await resolveNameViaAPI(trimmed);
      }
    }

    if (address) {
      try {
        const n = normalize(trimmed.includes(":") ? trimmed.substring(0, colonIndex) : trimmed);
        avatar = await mainnetClient.getEnsAvatar({ name: n });
        if (!avatar) avatar = await baseClient.getEnsAvatar({ name: n });
        if (!avatar) avatar = await getAvatarViaAPI(trimmed);
      } catch {
        avatar = await getAvatarViaAPI(trimmed);
      }
    }
  } catch {
    address = await resolveNameViaAPI(trimmed);
    if (address) avatar = await getAvatarViaAPI(trimmed);
  }

  return { address, avatar: avatar ?? undefined };
}

/** Check if a string looks like an Ethereum address. */
export function isEthAddress(input: string): boolean {
  try {
    return isAddress(input.trim());
  } catch {
    return false;
  }
}
