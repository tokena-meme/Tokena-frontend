import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { swapQuoteExactIn } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getDbcClient } from './client';
import { confirmTx } from '@/lib/solana/connection';
import { insertTrade, updateLaunch, getLaunchByMint } from '@/lib/supabase/queries';
import { parseTradeError } from './errors';
import { getCachedSolPrice, quoteBuyOffchain, quoteSellOffchain } from '../utils/marketcap';

export interface TradeParams {
  poolAddress: string;
  mintAddress: string;
  wallet: WalletContextState;
  connection: Connection;
  slippageBps?: number; // default 100 = 1%
  priorityFeeSol?: number; // Priority gas limit natively structured
}

export interface BuyParams extends TradeParams {
  solAmount: number; // in SOL e.g. 0.5
}

export interface SellParams extends TradeParams {
  tokenAmount: number; // in tokens e.g. 500000
}

export interface TradeResult {
  txSignature: string;
  amountOut: number;
  priceImpact: number;
}

// ─── BUY ──────────────────────────────────────────────────────

export async function buyTokens(params: BuyParams): Promise<TradeResult> {
  const {
    poolAddress, mintAddress, wallet, connection,
    solAmount, slippageBps = 100,
  } = params;

  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const client = getDbcClient(connection);
  const pool = new PublicKey(poolAddress);

    const launch = await getLaunchByMint(mintAddress);
    if (!launch) throw new Error("Launch not found");

    const solPriceUsd = await getCachedSolPrice();
    const currentRaised = launch.sol_raised ?? 0;
    const quote = quoteBuyOffchain(solAmount, currentRaised, solPriceUsd);

    // Full SOL amount goes to pool — on-chain fee (creator tax + 1% platform) is deducted by the pool
    // The platform/creator split happens at claim time, not during trading
    const amountIn = new BN(Math.floor(solAmount * LAMPORTS_PER_SOL));
    
    const exactTokensOut = quote.tokensOut;
    const amountOutFinal = exactTokensOut;
    // Build swap transaction
    const transaction = await (client as any).pool.swap({
      owner: wallet.publicKey,
      payer: wallet.publicKey,
      pool,
      amountIn,
      minimumAmountOut: new BN(0),
      swapBaseForQuote: false,
      referralTokenAccount: null,
    });

    // Set explicit compute unit limit to avoid Solana allocating 200K per instruction
    const CU_LIMIT = 400_000;
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }));

    if (params.priorityFeeSol && params.priorityFeeSol > 0) {
      // microLamports = (feeSol * LAMPORTS_PER_SOL * 1_000_000) / CU_LIMIT
      const microLamports = Math.floor((params.priorityFeeSol * LAMPORTS_PER_SOL * 1_000_000) / CU_LIMIT);
      transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;

    try {
      const txSignature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: true,
        maxRetries: 3,
      });
      
      await confirmTx(txSignature, connection);
      
      const pricePerToken = solAmount / exactTokensOut;
      // Use net SOL (after fee) — only net moves the bonding curve
      const solRaisedAfter = currentRaised + (solAmount - quote.feeSol);
      const mcapUsd = quote.newMcapUsd;
      const tokenPriceUsd = quote.newPriceUsd;

      await insertTrade({
        launch_id: launch.id,
        mint_address: mintAddress,
        wallet_address: wallet.publicKey.toString(),
        type: 'buy',
        sol_amount: solAmount,
        token_amount: exactTokensOut,
        price_per_token: pricePerToken,
        price_impact: quote.priceImpact,
        fee_sol: quote.feeSol,
        tx_signature: txSignature,
        slot: null,
        sol_raised_after: solRaisedAfter,
        mcap_usd: mcapUsd,
        token_price_usd: tokenPriceUsd,
      });

      await updateLaunch(launch.id, {
        sol_raised: solRaisedAfter,
        migration_progress: Math.min((solRaisedAfter / 25) * 100, 100),
        volume_sol: (launch.volume_sol ?? 0) + solAmount,
        ath_mcap_usd: Math.max((launch.ath_mcap_usd ?? 0), mcapUsd),
      });

    return {
      txSignature,
      amountOut: amountOutFinal,
      priceImpact: 0,
    };
  } catch (err: any) {
    if (err.logs) {
      console.error('Swap buy simulation failed. Program logs:', err.logs);
    }
    throw err;
  }
}

// ─── SELL ──────────────────────────────────────────────────────

export async function sellTokens(params: SellParams): Promise<TradeResult> {
  const {
    poolAddress, mintAddress, wallet, connection,
    tokenAmount, slippageBps = 100,
  } = params;

  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const client = getDbcClient(connection);
  const pool = new PublicKey(poolAddress);
  const amountIn = new BN(Math.floor(tokenAmount * 1e6)); // TOKEN_DECIMALS = 6

    const launch = await getLaunchByMint(mintAddress);
    if (!launch) throw new Error("Launch not found");

    const solPriceUsd = await getCachedSolPrice();
    const currentRaised = launch.sol_raised ?? 0;
    const quote = quoteSellOffchain(tokenAmount, currentRaised, solPriceUsd);
    const exactSolOut = quote.solOut;
    const amountOutFinal = exactSolOut;

    // Build swap transaction
    const transaction = await (client as any).pool.swap({
      owner: wallet.publicKey,
      payer: wallet.publicKey,
      pool,
      amountIn,
      minimumAmountOut: new BN(0),
      swapBaseForQuote: true,
      referralTokenAccount: null,
    });

    // Set explicit compute unit limit to avoid Solana allocating 200K per instruction
    const CU_LIMIT = 400_000;
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }));

    if (params.priorityFeeSol && params.priorityFeeSol > 0) {
      // microLamports = (feeSol * LAMPORTS_PER_SOL * 1_000_000) / CU_LIMIT
      const microLamports = Math.floor((params.priorityFeeSol * LAMPORTS_PER_SOL * 1_000_000) / CU_LIMIT);
      transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;

    try {
      const txSignature = await wallet.sendTransaction(transaction, connection, {
        skipPreflight: true,
        maxRetries: 3,
      });
      
      await confirmTx(txSignature, connection);

      const pricePerToken = exactSolOut / tokenAmount;
      // Use gross SOL removed from curve (net + fee) — full amount left the curve
      const rawSolFromCurve = quote.solOut + quote.feeSol;
      const solRaisedAfter = Math.max(0, currentRaised - rawSolFromCurve);
      const mcapUsd = quote.newMcapUsd;
      const tokenPriceUsd = quote.newPriceUsd;

      await insertTrade({
        launch_id: launch.id,
        mint_address: mintAddress,
        wallet_address: wallet.publicKey.toString(),
        type: 'sell',
        sol_amount: exactSolOut,
        token_amount: tokenAmount,
        price_per_token: pricePerToken,
        price_impact: quote.priceImpact,
        fee_sol: quote.feeSol,
        tx_signature: txSignature,
        slot: null,
        sol_raised_after: solRaisedAfter,
        mcap_usd: mcapUsd,
        token_price_usd: tokenPriceUsd,
      });

      await updateLaunch(launch.id, {
        sol_raised: solRaisedAfter,
        migration_progress: Math.min((solRaisedAfter / 25) * 100, 100),
        volume_sol: (launch.volume_sol ?? 0) + exactSolOut,
        ath_mcap_usd: Math.max((launch.ath_mcap_usd ?? 0), mcapUsd),
      });

    return {
      txSignature,
      amountOut: amountOutFinal,
      priceImpact: 0,
    };
  } catch (err: any) {
    if (err.logs) {
      console.error('Swap sell simulation failed. Program logs:', err.logs);
    }
    throw err;
  }
}
