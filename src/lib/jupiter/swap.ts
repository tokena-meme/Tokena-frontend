import {
  Connection,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { confirmTx } from '@/lib/solana/connection';
import { insertTrade, updateLaunch, getLaunchByMint } from '@/lib/supabase/queries';
import { getCachedSolPrice } from '@/lib/utils/marketcap';

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const JUPITER_API = 'https://api.jup.ag/swap/v1';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TOKEN_DECIMALS = 6; // All Tokena tokens use 6 decimals

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
  swapUsdValue: string;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64-encoded VersionedTransaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  dynamicSlippageReport?: any;
}

export interface JupiterBuyQuote {
  tokensOut: number;
  priceImpact: number;
  pricePerToken: number;
  minimumReceived: number;
  route: string; // DEX label e.g. "Meteora DLMM"
  _raw: JupiterQuoteResponse;
}

export interface JupiterSellQuote {
  solOut: number;
  priceImpact: number;
  pricePerToken: number;
  minimumReceived: number;
  route: string;
  _raw: JupiterQuoteResponse;
}

export interface JupiterTradeResult {
  txSignature: string;
  amountOut: number;
  priceImpact: number;
}

// ─── QUOTE ────────────────────────────────────────────────────────────────

/**
 * Fetch a swap quote from Jupiter.
 */
export async function jupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string, // in smallest unit (lamports for SOL, raw for tokens)
  slippageBps: number = 100
): Promise<JupiterQuoteResponse> {
  const url = new URL(`${JUPITER_API}/quote`);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', amount);
  url.searchParams.set('slippageBps', slippageBps.toString());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Get a buy quote: SOL → Token.
 */
export async function jupiterBuyQuote(
  mintAddress: string,
  solAmount: number,
  slippageBps: number = 100
): Promise<JupiterBuyQuote> {
  const amountLamports = Math.floor(solAmount * LAMPORTS_PER_SOL).toString();
  const raw = await jupiterQuote(SOL_MINT, mintAddress, amountLamports, slippageBps);

  const tokensOut = Number(raw.outAmount) / Math.pow(10, TOKEN_DECIMALS);
  const minimumReceived = Number(raw.otherAmountThreshold) / Math.pow(10, TOKEN_DECIMALS);
  const pricePerToken = tokensOut > 0 ? solAmount / tokensOut : 0;
  const route = raw.routePlan?.[0]?.swapInfo?.label ?? 'Jupiter';

  return {
    tokensOut,
    priceImpact: parseFloat(raw.priceImpactPct) || 0,
    pricePerToken,
    minimumReceived,
    route,
    _raw: raw,
  };
}

/**
 * Get a sell quote: Token → SOL.
 */
export async function jupiterSellQuote(
  mintAddress: string,
  tokenAmount: number,
  slippageBps: number = 100
): Promise<JupiterSellQuote> {
  const amountRaw = Math.floor(tokenAmount * Math.pow(10, TOKEN_DECIMALS)).toString();
  const raw = await jupiterQuote(mintAddress, SOL_MINT, amountRaw, slippageBps);

  const solOut = Number(raw.outAmount) / LAMPORTS_PER_SOL;
  const minimumReceived = Number(raw.otherAmountThreshold) / LAMPORTS_PER_SOL;
  const pricePerToken = tokenAmount > 0 ? solOut / tokenAmount : 0;
  const route = raw.routePlan?.[0]?.swapInfo?.label ?? 'Jupiter';

  return {
    solOut,
    priceImpact: parseFloat(raw.priceImpactPct) || 0,
    pricePerToken,
    minimumReceived,
    route,
    _raw: raw,
  };
}

// ─── SWAP ─────────────────────────────────────────────────────────────────

/**
 * Get a serialized swap transaction from Jupiter.
 */
async function getSwapTransaction(
  quoteResponse: JupiterQuoteResponse,
  userPublicKey: string,
  priorityFeeSol: number = 0
): Promise<JupiterSwapResponse> {
  const body: any = {
    quoteResponse,
    userPublicKey,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: false,
  };

  // Add priority fee if specified
  if (priorityFeeSol > 0) {
    body.prioritizationFeeLamports = Math.floor(priorityFeeSol * LAMPORTS_PER_SOL);
  }

  const res = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter swap failed: ${res.status} ${text}`);
  }

  return res.json();
}

// ─── BUY (SOL → Token) ───────────────────────────────────────────────────

export async function jupiterBuy(params: {
  mintAddress: string;
  solAmount: number;
  slippageBps?: number;
  priorityFeeSol?: number;
  wallet: WalletContextState;
  connection: Connection;
}): Promise<JupiterTradeResult> {
  const {
    mintAddress, solAmount, wallet, connection,
    slippageBps = 100, priorityFeeSol = 0,
  } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  // 1. Get quote
  const quote = await jupiterBuyQuote(mintAddress, solAmount, slippageBps);

  // 2. Get swap transaction
  const swapResp = await getSwapTransaction(
    quote._raw,
    wallet.publicKey.toString(),
    priorityFeeSol
  );

  // 3. Deserialize, sign, and send
  const txBuf = Buffer.from(swapResp.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuf);

  const signed = await wallet.signTransaction!(transaction);
  const txSignature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  await confirmTx(txSignature, connection);

  // 4. Record trade in Supabase
  try {
    const launch = await getLaunchByMint(mintAddress);
    if (launch) {
      const solPriceUsd = await getCachedSolPrice();
      const pricePerToken = quote.pricePerToken;
      const mcapUsd = launch.total_supply * pricePerToken * solPriceUsd;

      await insertTrade({
        launch_id: launch.id,
        mint_address: mintAddress,
        wallet_address: wallet.publicKey.toString(),
        type: 'buy',
        sol_amount: solAmount,
        token_amount: quote.tokensOut,
        price_per_token: pricePerToken,
        price_impact: quote.priceImpact,
        fee_sol: 0,
        tx_signature: txSignature,
        slot: null,
        sol_raised_after: launch.sol_raised ?? 25, // Post-migration, stays at threshold
        mcap_usd: mcapUsd,
        token_price_usd: pricePerToken * solPriceUsd,
      });

      await updateLaunch(launch.id, {
        volume_sol: (launch.volume_sol ?? 0) + solAmount,
        ath_mcap_usd: Math.max((launch.ath_mcap_usd ?? 0), mcapUsd),
      });
    }
  } catch (err) {
    // Don't fail the trade if Supabase write fails
    console.warn('Failed to record Jupiter trade:', err);
  }

  return {
    txSignature,
    amountOut: quote.tokensOut,
    priceImpact: quote.priceImpact,
  };
}

// ─── SELL (Token → SOL) ──────────────────────────────────────────────────

export async function jupiterSell(params: {
  mintAddress: string;
  tokenAmount: number;
  slippageBps?: number;
  priorityFeeSol?: number;
  wallet: WalletContextState;
  connection: Connection;
}): Promise<JupiterTradeResult> {
  const {
    mintAddress, tokenAmount, wallet, connection,
    slippageBps = 100, priorityFeeSol = 0,
  } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  // 1. Get quote
  const quote = await jupiterSellQuote(mintAddress, tokenAmount, slippageBps);

  // 2. Get swap transaction
  const swapResp = await getSwapTransaction(
    quote._raw,
    wallet.publicKey.toString(),
    priorityFeeSol
  );

  // 3. Deserialize, sign, and send
  const txBuf = Buffer.from(swapResp.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(txBuf);

  const signed = await wallet.signTransaction!(transaction);
  const txSignature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  await confirmTx(txSignature, connection);

  // 4. Record trade in Supabase
  try {
    const launch = await getLaunchByMint(mintAddress);
    if (launch) {
      const solPriceUsd = await getCachedSolPrice();
      const pricePerToken = quote.pricePerToken;
      const mcapUsd = launch.total_supply * pricePerToken * solPriceUsd;

      await insertTrade({
        launch_id: launch.id,
        mint_address: mintAddress,
        wallet_address: wallet.publicKey.toString(),
        type: 'sell',
        sol_amount: quote.solOut,
        token_amount: tokenAmount,
        price_per_token: pricePerToken,
        price_impact: quote.priceImpact,
        fee_sol: 0,
        tx_signature: txSignature,
        slot: null,
        sol_raised_after: launch.sol_raised ?? 25,
        mcap_usd: mcapUsd,
        token_price_usd: pricePerToken * solPriceUsd,
      });

      await updateLaunch(launch.id, {
        volume_sol: (launch.volume_sol ?? 0) + quote.solOut,
        ath_mcap_usd: Math.max((launch.ath_mcap_usd ?? 0), mcapUsd),
      });
    }
  } catch (err) {
    console.warn('Failed to record Jupiter trade:', err);
  }

  return {
    txSignature,
    amountOut: quote.solOut,
    priceImpact: quote.priceImpact,
  };
}
