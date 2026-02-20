/**
 * Builds token lists so the API needs only 2 chain files + 2 token files.
 *
 * 1) testnet.tokens.json – built from manual entries only (no input files required).
 *    Adds USDC for Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia + Solana Devnet (USDC, WSOL).
 *
 * 2) mainnet.tokens.json – built from solana.json if present (Solana mainnet, chainId 101).
 *    Run once with solana.json in data/tokens, then you can delete solana.json.
 *
 * After build you only need:
 *   - data/chains/mainnet.chains.json, data/chains/testnet.chains.json
 *   - data/tokens/mainnet.tokens.json, data/tokens/testnet.tokens.json
 * You can delete: superbridge-tokenlist.json, solana.json, neslist.json, newlist.json, newerlist.json.
 *
 * Usage: pnpm run build-testnet-tokens
 * Outputs: data/tokens/testnet.tokens.json, data/tokens/mainnet.tokens.json (if solana.json was present)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TESTNET_CHAINS_PATH = join(ROOT, "data/chains/testnet.chains.json");
const TOKENS_DIR = join(ROOT, "data/tokens");
const TESTNET_OUTPUT = join(ROOT, "data/tokens/testnet.tokens.json");
const MAINNET_OUTPUT = join(ROOT, "data/tokens/mainnet.tokens.json");
const SOLANA_INPUT = join(ROOT, "data/tokens/solana.json");

interface TokenEntry {
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  address: string;
  chainId: number;
  extensions?: {
    opTokenId?: string;
    standardBridgeAddresses?: Record<string, string>;
  };
  // Allow other fields for input parsing, but we will clean them
  [key: string]: unknown;
}

interface TokenList {
  name: string;
  logoURI?: string;
  keywords?: string[];
  timestamp: string;
  tokens: TokenEntry[];
  version?: { major: number; minor: number; patch: number };
}

const USDC_TESTNET_LOGO =
  "https://raw.githubusercontent.com/ethereum-optimism/ethereum-optimism.github.io/01d7d6bf2ff3735b412da924d1df746ddd8a77a8/data/USDC/logo.png";

const USDC_TESTNET: Record<
  number,
  { address: string; bridgeL1?: number }
> = {
  11155111: {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    bridgeL1: 11155111,
  },
  84532: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    bridgeL1: 11155111,
  },
  421614: {
    address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    bridgeL1: 11155111,
  },
  11155420: {
    address: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    bridgeL1: 11155111,
  },
};

// Solana Devnet Tokens (Chain ID 103 for Wormhole/Testnet convention)
const SOLANA_DEVNET_CHAIN_ID = 103;
const SOLANA_TOKENS: TokenEntry[] = [
  {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    logoURI: USDC_TESTNET_LOGO,
    address: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    chainId: SOLANA_DEVNET_CHAIN_ID,
  },
  {
    name: "Wrapped SOL",
    symbol: "WSOL",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    address: "So11111111111111111111111111111111111111112",
    chainId: SOLANA_DEVNET_CHAIN_ID,
  },
];

function loadTestnetChainIds(): Set<number> {
  const raw = readFileSync(TESTNET_CHAINS_PATH, "utf-8");
  const chains: { id?: number }[] = JSON.parse(raw);
  const ids = new Set<number>();
  for (const c of chains) {
    if (typeof c.id === "number") ids.add(c.id);
  }
  // Ensure Solana Devnet/Testnet IDs are included if not already
  ids.add(102);
  ids.add(103);
  return ids;
}

function loadInputTokens(path: string): TokenEntry[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as unknown;

    if (Array.isArray(data)) {
      return data as TokenEntry[];
    }

    if (data && typeof data === "object" && Array.isArray((data as TokenList).tokens)) {
      return (data as TokenList).tokens;
    }
  } catch (e) {
    console.warn(`Failed to parse ${path}:`, e);
  }
  return [];
}

function cleanToken(token: TokenEntry): TokenEntry {
  // Create a new object with only allowed fields
  const cleaned: TokenEntry = {
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    address: token.address,
    chainId: token.chainId,
  };

  if (token.logoURI) cleaned.logoURI = token.logoURI;
  if (token.extensions) cleaned.extensions = token.extensions;

  return cleaned;
}

function buildTestnetList(): TokenList {
  const testnetChainIds = loadTestnetChainIds();
  const tokens: TokenEntry[] = [];
  const existingByChain = new Set<string>();

  // Helper to add tokens safely
  const addToken = (t: TokenEntry) => {
    // Basic validation
    if (!t.address || typeof t.chainId !== "number") return;

    // Filter by testnet chain ID
    if (!testnetChainIds.has(t.chainId)) return;

    const key = `${t.chainId}:${t.address.toLowerCase()}`;
    if (!existingByChain.has(key)) {
      existingByChain.add(key);
      tokens.push(cleanToken(t));
    }
  };

  // 1. Manual USDC for major testnets
  for (const [chainIdStr, info] of Object.entries(USDC_TESTNET)) {
    const chainId = Number(chainIdStr);
    if (!testnetChainIds.has(chainId)) continue;
    const key = `${chainId}:${info.address.toLowerCase()}`;
    if (!existingByChain.has(key)) {
      addToken({
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        logoURI: USDC_TESTNET_LOGO,
        address: info.address,
        chainId,
        extensions: {
          opTokenId: "USDC",
          standardBridgeAddresses:
            info.bridgeL1 != null
              ? { [String(info.bridgeL1)]: "0x4200000000000000000000000000000000000010" }
              : undefined,
        },
      });
    }
  }

  // 2. Manual Solana Devnet tokens
  for (const t of SOLANA_TOKENS) {
    addToken(t);
  }

  // Sort
  tokens.sort((a, b) => {
    if (a.chainId !== b.chainId) return a.chainId - b.chainId;
    return (a.symbol ?? "").localeCompare(b.symbol ?? "");
  });

  return {
    name: "Superbridge Superchain Token List (Testnet)",
    logoURI: "https://ethereum-optimism.github.io/optimism.svg",
    keywords: ["scaling", "layer2", "infrastructure", "testnet"],
    timestamp: new Date().toISOString(),
    tokens,
    version: { major: 1, minor: 0, patch: 0 },
  };
}

function buildMainnetSolanaList(): TokenList | null {
  if (!existsSync(SOLANA_INPUT)) return null;
  try {
    const raw = readFileSync(SOLANA_INPUT, "utf-8");
    const data = JSON.parse(raw) as unknown;
    const list = (data && typeof data === "object" && Array.isArray((data as TokenList).tokens))
      ? (data as TokenList)
      : null;
    if (!list?.tokens?.length) return null;
    const solanaOnly = list.tokens
      .filter((t) => t.chainId === 101 && t.address)
      .map((t) => cleanToken(t));
    if (solanaOnly.length === 0) return null;
    return {
      name: "Solana Mainnet Tokens",
      logoURI: list.logoURI,
      keywords: ["solana", "mainnet"],
      timestamp: new Date().toISOString(),
      tokens: solanaOnly,
      version: list.version ?? { major: 1, minor: 0, patch: 0 },
    };
  } catch (e) {
    console.warn("Could not build mainnet.tokens.json from solana.json:", e);
    return null;
  }
}

function main(): void {
  const outDir = join(ROOT, "data/tokens");
  mkdirSync(outDir, { recursive: true });

  console.log("Building testnet token list (manual entries only)...");
  const testnetList = buildTestnetList();
  writeFileSync(TESTNET_OUTPUT, JSON.stringify(testnetList, null, 2), "utf-8");
  console.log(`Wrote ${TESTNET_OUTPUT} (${testnetList.tokens.length} tokens).`);

  const mainnetList = buildMainnetSolanaList();
  if (mainnetList) {
    writeFileSync(MAINNET_OUTPUT, JSON.stringify(mainnetList, null, 2), "utf-8");
    console.log(`Wrote ${MAINNET_OUTPUT} (${mainnetList.tokens.length} Solana tokens). You can delete solana.json.`);
  } else {
    console.log("No solana.json found; mainnet.tokens.json not written. Add solana.json and re-run to generate it.");
  }
}

main();
