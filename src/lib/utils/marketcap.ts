import { TOKENOMICS } from '../constants/tokenomics';
import { TRADING_FEE_PCT } from '../meteora/constants';

const { INITIAL_LP_SOL, MIGRATION_LP_SOL, TOTAL_SUPPLY, K } = TOKENOMICS;

// ─── CORE FORMULA ──────────────────────────────────────────────────────────

/**
 * Market cap in SOL given how much SOL has been raised so far.
 *
 *   mcap_sol = (initial_lp + sol_raised)² / initial_lp
 *            = (5 + sol_raised)² / 5
 */
export function getMcapSol(solRaised: number): number {
  const v = INITIAL_LP_SOL + solRaised;
  return (v * v) / INITIAL_LP_SOL;
}

/**
 * Market cap in USD — this is the primary display value across all of Tokena.
 *
 *   mcap_usd = mcap_sol × sol_price_usd
 */
export function getMcapUsd(solRaised: number, solPriceUsd: number): number {
  return getMcapSol(solRaised) * solPriceUsd;
}

/**
 * Price per token in USD.
 *
 *   price_usd = (mcap_usd / total_supply)
 */
export function getTokenPriceUsd(solRaised: number, solPriceUsd: number): number {
  return getMcapUsd(solRaised, solPriceUsd) / TOTAL_SUPPLY;
}

/**
 * Price per token in SOL.
 */
export function getTokenPriceSol(solRaised: number): number {
  const v = INITIAL_LP_SOL + solRaised;
  return (v * v) / K;
}

// ─── MIGRATION ────────────────────────────────────────────────────────────

/**
 * Migration progress 0–100%.
 */
export function getMigrationProgress(solRaised: number): number {
  return Math.min((solRaised / MIGRATION_LP_SOL) * 100, 100);
}

/**
 * Market cap USD at launch (sol_raised = 0).
 */
export function getLaunchMcapUsd(solPriceUsd: number): number {
  return getMcapUsd(0, solPriceUsd);
}

/**
 * Market cap (FDV) at migration (sol_raised = 25 SOL).
 * FDV = (INITIAL_LP + MIGRATION_LP)² / INITIAL_LP × solPrice
 *     = (5 + 25)² / 5 × solPrice = 180 × solPrice
 */
export function getMigrationMcapUsd(solPriceUsd: number): number {
  return getMcapUsd(MIGRATION_LP_SOL, solPriceUsd);
}

// ─── REVERSE LOOKUPS ─────────────────────────────────────────────────────

/**
 * Given a USD market cap, return the implied sol_raised.
 * Useful for reconstructing curve position from stored mcap.
 *
 *   sol_raised = sqrt(mcap_usd / sol_price × initial_lp) - initial_lp
 */
export function getSolRaisedFromMcapUsd(
  mcapUsd: number,
  solPriceUsd: number
): number {
  const mcapSol = mcapUsd / solPriceUsd;
  return Math.sqrt(mcapSol * INITIAL_LP_SOL) - INITIAL_LP_SOL;
}

/**
 * Tokens sold at a given sol_raised level.
 *
 *   tokens_sold = total_supply - (k / virtual_sol)
 */
export function getTokensSold(solRaised: number): number {
  const virtualSol = INITIAL_LP_SOL + solRaised;
  return TOTAL_SUPPLY - K / virtualSol;
}

// ─── OFF-CHAIN QUOTES ────────────────────────────────────────────────────

/**
 * Off-chain buy quote.
 * Returns tokens out, new mcap USD, price impact.
 */
export function quoteBuyOffchain(
  solIn: number,
  currentSolRaised: number,
  solPriceUsd: number
): {
  tokensOut:   number;
  newMcapUsd:  number;
  newPriceUsd: number;
  priceImpact: number;   // fraction e.g. 0.02 = 2%
  feeSol:      number;
} {
  const feeSol    = solIn * TRADING_FEE_PCT;
  const solInNet  = solIn - feeSol;

  const vSol      = INITIAL_LP_SOL + currentSolRaised;
  const vTokens   = K / vSol;

  const newVSol   = vSol + solInNet;
  const newVTokens= K / newVSol;
  const tokensOut = vTokens - newVTokens;

  const oldMcap   = getMcapUsd(currentSolRaised, solPriceUsd);
  const newSolRaised = currentSolRaised + solInNet;
  const newMcapUsd = getMcapUsd(newSolRaised, solPriceUsd);
  const priceImpact = (newMcapUsd - oldMcap) / oldMcap;

  return {
    tokensOut,
    newMcapUsd,
    newPriceUsd: getTokenPriceUsd(newSolRaised, solPriceUsd),
    priceImpact,
    feeSol,
  };
}

/**
 * Off-chain sell quote.
 */
export function quoteSellOffchain(
  tokensIn: number,
  currentSolRaised: number,
  solPriceUsd: number
): {
  solOut:      number;
  newMcapUsd:  number;
  newPriceUsd: number;
  priceImpact: number;
  feeSol:      number;
} {
  const vSol       = INITIAL_LP_SOL + currentSolRaised;
  const vTokens    = K / vSol;

  const newVTokens = vTokens + tokensIn;
  const newVSol    = K / newVTokens;
  const rawSolOut  = vSol - newVSol;

  const feeSol     = rawSolOut * TRADING_FEE_PCT;
  const solOut     = rawSolOut - feeSol;

  const newSolRaised = Math.max(0, currentSolRaised - rawSolOut);
  const oldMcap    = getMcapUsd(currentSolRaised, solPriceUsd);
  const newMcapUsd = getMcapUsd(newSolRaised, solPriceUsd);
  const priceImpact = (oldMcap - newMcapUsd) / oldMcap;

  return {
    solOut,
    newMcapUsd,
    newPriceUsd: getTokenPriceUsd(newSolRaised, solPriceUsd),
    priceImpact,
    feeSol,
  };
}

// ─── SOL PRICE FETCHING ──────────────────────────────────────────────────

let _price      = 150;
let _fetchedAt  = 0;
const TTL       = 60_000;

export async function getCachedSolPrice(): Promise<number> {
  if (Date.now() - _fetchedAt < TTL) return _price;
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const d = await r.json();
    _price     = d.solana.usd;
    _fetchedAt = Date.now();
  } catch { /* keep stale */ }
  return _price;
}

// ─── DISPLAY FORMATTERS ──────────────────────────────────────────────────

/**
 * Format mcap USD for display.
 *   $1,234     → "$1.2K"
 *   $54,000    → "$54K"
 *   $1,200,000 → "$1.2M"
 */
export function formatMcapUsd(mcapUsd: number | undefined | null): string {
  if (!mcapUsd) return "$0";
  if (mcapUsd >= 1_000_000_000) return `$${(mcapUsd / 1_000_000_000).toFixed(2)}B`;
  if (mcapUsd >= 1_000_000)     return `$${(mcapUsd / 1_000_000).toFixed(2)}M`;
  if (mcapUsd >= 1_000)         return `$${(mcapUsd / 1_000).toFixed(1)}K`;
  return `$${mcapUsd.toFixed(2)}`;
}

const SUBSCRIPTS = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];

/**
 * Core utility to format tiny cryptocoin numbers gracefully with subscript zeros.
 */
export function formatSubscriptZeroes(val: number | undefined | null, prefix: string = '', suffix: string = ''): string {
  if (!val || val === 0) return `${prefix}0.00${suffix}`;

  if (val < 0.001) {
    const str = val.toFixed(12);
    const match = str.match(/^0\.0+/);
    
    if (match) {
      const zeroCount = match[0].length - 2; // Subtract the "0."
      if (zeroCount >= 3) {
        const strippedZeros = str.replace(/^0\.0+/, '');
        // Keep up to 4 significant digits, strip lagging zeros
        const sigDigits = strippedZeros.slice(0, 4).replace(/0+$/, '');
        const subscriptPrefix = zeroCount.toString().split('').map(d => SUBSCRIPTS[parseInt(d)]).join('');
        return `${prefix}0.0${subscriptPrefix}${sigDigits}${suffix}`;
      }
    }
    return `${prefix}${val.toFixed(6).replace(/\.?0+$/, '')}${suffix}`;
  }

  if (val < 1) return `${prefix}${val.toFixed(5).replace(/\.?0+$/, '')}${suffix}`;
  return `${prefix}${val.toFixed(4)}${suffix}`;
}

/**
 * Format token price USD for display.
 *   Uses subscript zero notation for tiny fractionals (e.g., $0.0₅266).
 */
export function formatTokenPriceUsd(priceUsd: number | undefined | null): string {
  return formatSubscriptZeroes(priceUsd, '$');
}

/**
 * Format token price in SOL for display.
 */
export function formatTokenPriceSol(priceSol: number | undefined | null): string {
  return formatSubscriptZeroes(priceSol, '', ' SOL');
}

/**
 * Format a percentage change.
 *   0.184 → "+18.4%"
 *  -0.08  → "-8.0%"
 */
export function formatChange(fraction: number | undefined | null): string {
  if (!fraction) return "0.0%";
  const pct = fraction * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}
