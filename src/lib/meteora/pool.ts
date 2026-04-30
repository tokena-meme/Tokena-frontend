import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import {
  buildCurveWithMarketCap,
  MigrationOption,
  MigrationFeeOption,
  ActivationType,
  TokenType,
  CollectFeeMode,
  BaseFeeMode,
  TokenUpdateAuthorityOption,
  DAMM_V2_MIGRATION_FEE_ADDRESS,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getDbcClient } from './client';
import { confirmTx } from '@/lib/solana/connection';
import { createLaunch, insertTrade, updateLaunch } from '@/lib/supabase/queries';
import { quoteBuyOffchain, getCachedSolPrice } from '@/lib/utils/marketcap';
import {
  TOKEN_DECIMALS,
  PLATFORM_FEE_WALLET,
} from './constants';

export interface LaunchTokenParams {
  // Token metadata
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;         // Already uploaded IPFS URL
  metadataUri: string;      // Pinata ipfs:// URI directly mapped
  twitter?: string;
  telegram?: string;
  website?: string;
  // Curve config
  initialPriceSol: number;  // e.g. 0.000001
  migrationThresholdSol: number; // e.g. 85
  totalSupply: number;      // e.g. 1_000_000_000
  creatorFeePercent?: number; // 0–5%, default 0
  initialBuySol?: number;     // Optional initial buy amount in SOL (bundled in same tx)
  // Wallet
  wallet: WalletContextState;
  connection: Connection;
}

export interface LaunchTokenResult {
  mintAddress: string;
  poolAddress: string;
  txSignature: string;
  metadataUri: string;
}

/**
 * Full launch flow using the actual Meteora DBC SDK:
 * 1. Build on-chain metadata URI
 * 2. Build curve config via buildCurveWithMarketCap
 * 3. Create config + pool on-chain via client.pool.createConfigAndPool
 * 4. Store in Supabase
 */
export async function launchToken(
  params: LaunchTokenParams
): Promise<LaunchTokenResult> {
  const {
    name, symbol, description, imageUrl, metadataUri,
    twitter, telegram, website,
    initialPriceSol, migrationThresholdSol, totalSupply,
    creatorFeePercent = 0,
    wallet, connection,
  } = params;

  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  // Step 1: Upload metadata JSON to IPFS (now handled outwardly sequentially)

  // Step 2: Generate a new keypair for the token mint and pool config
  const baseMintKeypair = Keypair.generate();
  const configKeypair = Keypair.generate();

  const client = getDbcClient(connection);

  // Market cap values for buildCurveWithMarketCap (FDV in SOL).
  //  - initialMarketCap: 5 SOL FDV at launch
  //  - migrationMarketCap: 180 SOL FDV at graduation (~25 SOL raised)
  const initialMarketCap = 5;
  const migrationMarketCap = 180;

  // Build the curve configuration using the SDK helper
  // IMPORTANT: Meteora takes a fixed 20% protocol fee from all trading fees.
  // Only 80% of the total fee reaches the feeClaimer.
  // To get the desired effective fees, we inflate the BPS: desired / 0.8
  //
  // Base fee structure (always applies):
  //   0.8% to feeClaimer (split: 0.4% creator + 0.4% platform at claim time)
  //   0.2% to Meteora protocol (20% of 1%)
  //   Total: 1% charged to the trader
  //
  // If creator adds a tax (e.g. 5%):
  //   Desired effective = creatorTax + 0.8% → On-chain BPS = (creatorTax + 0.8) / 0.8 × 100
  //   e.g. 5% + 0.8% = 5.8% → 5.8 / 0.8 = 7.25% = 725 BPS
  //   Trader pays 7.25% → Meteora takes 20% (1.45%) → feeClaimer gets 5.8%
  //   At claim: platform takes 0.4%, creator keeps 5.4%
  const METEORA_PROTOCOL_CUT = 0.20; // Meteora takes 20%
  const LP_SHARE = 1 - METEORA_PROTOCOL_CUT; // 80% reaches feeClaimer

  const basePlatformPct = 0.8; // 0.8% base fee (0.4% creator + 0.4% platform)
  const desiredTotalPct = creatorFeePercent + basePlatformPct; // e.g. 0 + 0.8 = 0.8%, or 5 + 0.8 = 5.8%
  const inflatedPct = desiredTotalPct / LP_SHARE; // e.g. 0.8 / 0.8 = 1%, or 5.8 / 0.8 = 7.25%
  const totalFeeBps = Math.round(inflatedPct * 100); // e.g. 100 BPS, or 725 BPS

  // 100% of the LP fee (80% of total) goes to the feeClaimer
  // The split between creator and platform happens at claim time
  const creatorFeeShare = 100;

  const curveConfig = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPL,
      tokenBaseDecimal: TOKEN_DECIMALS,
      tokenQuoteDecimal: 9, // SOL has 9 decimals
      tokenUpdateAuthority: TokenUpdateAuthorityOption.Immutable,
      totalTokenSupply: totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: totalFeeBps,
          endingFeeBps: totalFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: creatorFeeShare,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: {
        feePercentage: 1,
        creatorFeePercentage: 0,
      },
      migratedPoolFee: {
        collectFeeMode: 0,
        dynamicFee: 0,
        poolFeeBps: 0,
      },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Slot,
    initialMarketCap,
    migrationMarketCap,
  });

  // Step 3: Create config + pool on-chain
  // NOTE: Initial buy is sent as TX2 after pool creation because bundling
  // everything exceeds Solana's 1232-byte transaction size limit.
  const quoteMint = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL

  const initialBuySol = params.initialBuySol ?? 0;
  const hasInitialBuy = initialBuySol > 0;

  const transaction = await (client as any).pool.createConfigAndPool({
    ...curveConfig,
    tokenSupply: null,
    config: configKeypair.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    quoteMint,
    payer: wallet.publicKey,
    tokenType: TokenType.SPL,
    preCreatePoolParam: {
      name,
      symbol,
      uri: metadataUri,
      baseMint: baseMintKeypair.publicKey,
      payer: wallet.publicKey,
      poolCreator: wallet.publicKey,
      config: configKeypair.publicKey,
    },
  });

  // Assemble into a single transaction if SDK returned separate txs
  let txToSign: Transaction;
  if (transaction instanceof Transaction) {
    txToSign = transaction;
  } else {
    txToSign = new Transaction();
    if (transaction.createConfigTx) txToSign.add(transaction.createConfigTx);
    if (transaction.createPoolWithFirstBuyTx) txToSign.add(transaction.createPoolWithFirstBuyTx);
  }

  // Add Platform Fee for Deployment (0.01 SOL)
  const feePubkey = new PublicKey(PLATFORM_FEE_WALLET);
  const feeIx = SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: feePubkey,
    lamports: 0.01 * 1e9,
  });
  txToSign.add(feeIx);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  txToSign.recentBlockhash = blockhash;
  txToSign.lastValidBlockHeight = lastValidBlockHeight;
  txToSign.feePayer = wallet.publicKey;

  // TX1: Create config + pool + deployment fee
  const txSignature = await wallet.sendTransaction(txToSign, connection, {
    signers: [configKeypair, baseMintKeypair],
    skipPreflight: true,
    maxRetries: 3,
  });

  await confirmTx(txSignature, connection);

  // Derive pool address
  const { deriveDbcPoolAddress } = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const poolAddress = deriveDbcPoolAddress(quoteMint, baseMintKeypair.publicKey, configKeypair.publicKey);

  // Step 5: Write launch to Supabase BEFORE TX2 so the trade can reference it
  const launchRecord = await createLaunch({
    creator_wallet: wallet.publicKey!.toString(),
    name,
    symbol,
    description,
    image_url: imageUrl,
    metadata_uri: metadataUri,
    twitter: twitter ?? null,
    telegram: telegram ?? null,
    website: website ?? null,
    mint_address: baseMintKeypair.publicKey.toString(),
    dbc_pool_address: poolAddress.toString(),
    initial_price_sol: initialPriceSol,
    migration_threshold_sol: migrationThresholdSol,
    total_supply: totalSupply,
    creator_fee_percent: creatorFeePercent,
  });

  // TX2: Initial buy (separate transaction — pool must exist on-chain first)
  if (hasInitialBuy && wallet.publicKey && wallet.sendTransaction) {
    try {
      const buyAmountLamports = new BN(Math.floor(initialBuySol * LAMPORTS_PER_SOL));

      const swapTx = await (client as any).pool.swap({
        owner: wallet.publicKey,
        payer: wallet.publicKey,
        pool: poolAddress,
        amountIn: buyAmountLamports,
        minimumAmountOut: new BN(0),
        swapBaseForQuote: false,
        referralTokenAccount: null,
      });

      const { blockhash: bh2, lastValidBlockHeight: lvbh2 } =
        await connection.getLatestBlockhash('confirmed');
      swapTx.recentBlockhash = bh2;
      swapTx.lastValidBlockHeight = lvbh2;
      swapTx.feePayer = wallet.publicKey;

      const buyTxSig = await wallet.sendTransaction(swapTx, connection, {
        skipPreflight: true,
        maxRetries: 3,
      });

      await confirmTx(buyTxSig, connection);

      // Record initial buy trade in Supabase (appears in live feed + chart)
      try {
        const solPriceUsd = await getCachedSolPrice();
        const quote = quoteBuyOffchain(initialBuySol, 0, solPriceUsd);
        const solRaisedAfter = initialBuySol - quote.feeSol;

        await insertTrade({
          launch_id: launchRecord.id,
          mint_address: baseMintKeypair.publicKey.toString(),
          wallet_address: wallet.publicKey!.toString(),
          type: 'buy',
          sol_amount: initialBuySol,
          token_amount: quote.tokensOut,
          price_per_token: initialBuySol / quote.tokensOut,
          price_impact: quote.priceImpact,
          fee_sol: quote.feeSol,
          tx_signature: buyTxSig,
          slot: null,
          sol_raised_after: solRaisedAfter,
          mcap_usd: quote.newMcapUsd,
          token_price_usd: quote.newPriceUsd,
        });

        await updateLaunch(launchRecord.id, {
          sol_raised: solRaisedAfter,
          migration_progress: Math.min((solRaisedAfter / 25) * 100, 100),
          volume_sol: initialBuySol,
          ath_mcap_usd: quote.newMcapUsd,
        });
      } catch (tradeErr) {
        console.warn('Failed to record initial buy trade:', tradeErr);
      }
    } catch (err) {
      console.warn('Initial buy failed (pool was created successfully):', err);
    }
  }

  return {
    mintAddress: baseMintKeypair.publicKey.toString(),
    poolAddress: poolAddress.toString(),
    txSignature,
    metadataUri,
  };
}
