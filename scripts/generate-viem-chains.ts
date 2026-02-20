/**
 * Generates mainnet.chains.json and testnet.chains.json from viem's chain definitions.
 * Run: pnpm run generate-chains
 *
 * Output files are used as a registry to supply RPCs and explorers for Squid chains
 * (and as the sole source for testnet chains, since Squid testnet endpoint is deprecated).
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

interface ViemChainLike {
  id?: number;
  name?: string;
  network?: string;
  rpcUrls?: { default?: { http?: string[] }; [key: string]: unknown };
  blockExplorers?: {
    default?: { name?: string; url?: string; apiUrl?: string };
    [key: string]: unknown;
  };
  testnet?: boolean;
}

interface ChainEntry {
  id: number;
  name: string;
  network?: string;
  rpcs: string[];
  explorer?: { name?: string; url?: string; apiUrl?: string };
  testnet: boolean;
}

function isChainLike(value: unknown): value is ViemChainLike {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "number") return false;
  if (typeof o.name !== "string") return false;
  const rpcUrls = o.rpcUrls;
  if (!rpcUrls || typeof rpcUrls !== "object") return false;
  const def = (rpcUrls as Record<string, unknown>).default;
  if (!def || typeof def !== "object") return false;
  const http = (def as Record<string, unknown>).http;
  if (!Array.isArray(http)) return false;
  return true;
}

function toChainEntry(chain: ViemChainLike): ChainEntry {
  const http = chain.rpcUrls?.default?.http ?? [];
  const rpcs = Array.isArray(http) ? http.filter((u): u is string => typeof u === "string") : [];
  const explorerDef = chain.blockExplorers?.default;
  const explorer =
    explorerDef && (explorerDef.url || explorerDef.name)
      ? {
          name: explorerDef.name,
          url: explorerDef.url,
          apiUrl: explorerDef.apiUrl,
        }
      : undefined;
  return {
    id: chain.id!,
    name: chain.name ?? String(chain.id),
    network: chain.network,
    rpcs,
    explorer,
    testnet: Boolean(chain.testnet),
  };
}

async function main(): Promise<void> {
  const viemChains = await import("viem/chains");
  const values = Object.values(viemChains) as unknown[];
  const chains: ChainEntry[] = values.filter(isChainLike).map(toChainEntry);

  const byId = (a: ChainEntry, b: ChainEntry) => a.id - b.id;
  const mainnet = chains.filter((c) => !c.testnet).sort(byId);
  const testnet = chains.filter((c) => c.testnet).sort(byId);

  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const outDir = join(root, "data", "chains");
  mkdirSync(outDir, { recursive: true });

  const mainnetPath = join(outDir, "mainnet.chains.json");
  const testnetPath = join(outDir, "testnet.chains.json");

  writeFileSync(mainnetPath, JSON.stringify(mainnet, null, 2), "utf-8");
  writeFileSync(testnetPath, JSON.stringify(testnet, null, 2), "utf-8");

  console.log(`Wrote ${mainnet.length} mainnet chains to ${mainnetPath}`);
  console.log(`Wrote ${testnet.length} testnet chains to ${testnetPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
