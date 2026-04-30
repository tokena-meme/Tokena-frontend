import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getDbcClient } from './client';
import { TOKENOMICS } from '../constants/tokenomics';

export interface PoolState {
  mintAddress: string;
  solRaised: number;
  migrationThreshold: number;
  migrationProgress: number;     // 0–100
  isMigrated: boolean;
  meteoraPoolAddress: string | null;
  currentPrice: number;          // SOL per token
  marketCapSol: number;
  totalSupply: number;
  tokensAvailable: number;
}

// Validate that a string is a valid base58-encoded Solana address
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch pool state using the SDK's StateService (client.state.getPool).
 * The state service reads the on-chain pool account data.
 */
export async function getPoolState(
  poolAddress: string,
  connection: Connection
): Promise<PoolState> {
  // Validate address before attempting on-chain fetch
  if (!isValidSolanaAddress(poolAddress)) {
    throw new Error(`Invalid pool address: ${poolAddress}`);
  }

  const client = getDbcClient(connection);
  const pool = new PublicKey(poolAddress);

  // Use client.state.getPool to fetch pool account data
  const state = await (client as any).state.getPool(pool);

  if (!state) {
    throw new Error(`Pool not found: ${poolAddress}`);
  }

  // Parse on-chain data
  // The pool state structure includes quoteReserve, config, baseMint, etc.
  const quoteReserve = state.quoteReserve
    ? Number(state.quoteReserve.toString()) / LAMPORTS_PER_SOL
    : 0;

  // Get config to read migration threshold
  let migrationThreshold = 0;
  try {
    const config = await (client as any).state.getPoolConfig(state.config);
    if (config) {
      migrationThreshold = config.migrationQuoteThreshold
        ? Number(config.migrationQuoteThreshold.toString()) / LAMPORTS_PER_SOL
        : 0;
    }
  } catch {
    // Config might not be readable
  }

  const progress = migrationThreshold > 0
    ? Math.min((quoteReserve / migrationThreshold) * 100, 100)
    : 0;

  // Determine if migrated (quote reserve >= threshold)
  const isMigrated = migrationThreshold > 0 && quoteReserve >= migrationThreshold;

  // Estimate current price from curve state
  const totalSupplyRaw = state.totalBaseSupply
    ? Number(state.totalBaseSupply.toString()) / 1e6
    : 0;
  
  // Current price can be derived from the curve's sqrt price
  let currentPrice = 0;
  if (state.sqrtPrice) {
    // sqrtPrice is Q64 fixed-point
    const sqrtPriceNum = Number(state.sqrtPrice.toString()) / (2 ** 64);
    currentPrice = sqrtPriceNum * sqrtPriceNum * (1e6 / LAMPORTS_PER_SOL);
  }

  return {
    mintAddress: state.baseMint?.toString() ?? '',
    solRaised: quoteReserve,
    migrationThreshold,
    migrationProgress: progress,
    isMigrated,
    meteoraPoolAddress: null,
    currentPrice,
    marketCapSol: currentPrice * totalSupplyRaw,
    totalSupply: totalSupplyRaw,
    tokensAvailable: 0, // Would need curve calculation
  };
}

/**
 * Lightweight on-chain market cap fetch.
 * Reads the pool's quoteReserve (actual SOL in the bonding curve)
 * and derives market cap using the bonding curve formula.
 *
 * Returns { solRaised, marketCapSol, marketCapUsd } or null on failure.
 */
export async function getOnChainMcap(
  poolAddress: string,
  connection: Connection,
  solPriceUsd: number
): Promise<{ solRaised: number; marketCapSol: number; marketCapUsd: number } | null> {
  if (!isValidSolanaAddress(poolAddress)) return null;

  try {
    const client = getDbcClient(connection);
    const pool = new PublicKey(poolAddress);
    const state = await (client as any).state.getPool(pool);
    if (!state) return null;

    const solRaised = state.quoteReserve
      ? Number(state.quoteReserve.toString()) / LAMPORTS_PER_SOL
      : 0;

    // FDV from bonding curve formula: mcap_sol = (initial_lp + sol_raised)² / initial_lp
    const v = TOKENOMICS.INITIAL_LP_SOL + solRaised;
    const marketCapSol = (v * v) / TOKENOMICS.INITIAL_LP_SOL;
    const marketCapUsd = marketCapSol * solPriceUsd;

    return { solRaised, marketCapSol, marketCapUsd };
  } catch (err) {
    console.error('getOnChainMcap error:', err);
    return null;
  }
}

/**
 * Poll pool state every N seconds.
 * Use in token detail page for live migration progress.
 */
export function startPoolStatePolling(
  poolAddress: string,
  connection: Connection,
  onUpdate: (state: PoolState) => void,
  intervalMs = 10000
): () => void {
  let running = true;

  const poll = async () => {
    if (!running) return;
    try {
      const state = await getPoolState(poolAddress, connection);
      if (running) onUpdate(state);
    } catch (err) {
      console.error('Pool state poll error:', err);
    }
  };

  poll(); // immediate first call
  const id = setInterval(poll, intervalMs);

  return () => {
    running = false;
    clearInterval(id);
  };
}
