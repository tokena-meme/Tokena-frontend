import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { getDbcClient } from './client';
import { confirmTx } from '@/lib/solana/connection';
import { PLATFORM_FEE_WALLET } from './constants';

export interface ClaimFeesParams {
  poolAddress: string;
  wallet: WalletContextState;
  connection: Connection;
  creatorFeePercent: number; // The creator's tax % (e.g. 5). Needed to compute the split.
  poolCreator?: string;      // Original creator of the pool (needed for Meteora SDK args)
}

export interface ClaimFeesResult {
  txSignature: string;
}

export interface ClaimableInfo {
  poolAddress: string;
  claimableSol: number;     // Creator's share only (excludes platform 0.4%)
  totalClaimedSol: number;  // Creator's share only (excludes platform 0.4%)
}

/**
 * Helper: compute the creator's fraction of the total pool fee.
 *
 *   Pool fee to feeClaimer = creatorTax% + 0.8% base.
 *   Of the 0.8% base: 0.4% goes to creator, 0.4% goes to platform.
 *   Creator share = (creatorTax + 0.4) / (creatorTax + 0.8).
 *   e.g. creator 5% → total 5.8% → creator fraction = 5.4/5.8 ≈ 0.931
 *
 *   0% Tax Special Case: feeClaimer gets 0.8%.
 *   Creator gets 0.4% (50%) and the platform gets 0.4% (50%).
 */
function creatorFraction(creatorFeePercent: number): number {
  if (creatorFeePercent <= 0) return 0.5; // 50% to creator (0.4% of 0.8%)
  return (creatorFeePercent + 0.4) / (creatorFeePercent + 0.8);
}

/**
 * Get the claimable + already-claimed trading fee for a given pool.
 * 
 * Returns only the creator's visible share.
 */
export async function getClaimableFee(
  poolAddress: string,
  connection: Connection,
  creatorFeePercent: number
): Promise<{ claimable: number; totalClaimed: number }> {
  try {
    const client = getDbcClient(connection);
    const pool = new PublicKey(poolAddress);

    const metrics = await (client as any).state.getPoolFeeMetrics(pool);
    if (!metrics || !metrics.current) {
      return { claimable: 0, totalClaimed: 0 };
    }

    // Raw unclaimed fee from pool
    const unclaimedLamports = metrics.current.creatorQuoteFee;
    const rawClaimable = typeof unclaimedLamports === 'object' && unclaimedLamports.toString
      ? Number(unclaimedLamports.toString()) / LAMPORTS_PER_SOL
      : Number(unclaimedLamports ?? 0) / LAMPORTS_PER_SOL;

    // Use creator's visible share.
    const fraction = creatorFraction(creatorFeePercent);
    const claimable = rawClaimable * fraction;

    let totalClaimed = 0;
    try {
      const breakdown = await (client as any).state.getPoolFeeBreakdown(pool);
      if (breakdown?.creator?.claimedQuoteFee) {
        const claimedLamports = breakdown.creator.claimedQuoteFee;
        const rawClaimed = typeof claimedLamports === 'object' && claimedLamports.toString
          ? Number(claimedLamports.toString()) / LAMPORTS_PER_SOL
          : Number(claimedLamports ?? 0) / LAMPORTS_PER_SOL;
        totalClaimed = rawClaimed * fraction;
      }
    } catch {
      // breakdown may fail — just return 0 for claimed
    }

    return { claimable, totalClaimed };
  } catch (err) {
    console.error('getClaimableFee error:', err);
    return { claimable: 0, totalClaimed: 0 };
  }
}

/**
 * Get claimable fees for multiple pools at once.
 */
export async function getClaimableFeesForPools(
  poolAddresses: string[],
  connection: Connection,
  creatorFeeMap: Record<string, number>
): Promise<ClaimableInfo[]> {
  const results = await Promise.allSettled(
    poolAddresses.map(async (addr) => {
      const creatorFeePct = creatorFeeMap[addr] ?? 0;
      const { claimable, totalClaimed } = await getClaimableFee(addr, connection, creatorFeePct);
      return {
        poolAddress: addr,
        claimableSol: claimable,
        totalClaimedSol: totalClaimed,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<ClaimableInfo> => r.status === 'fulfilled')
    .map((r) => r.value);
}

/**
 * Claim accumulated creator trading fees from a Meteora DBC pool.
 *
 * The full pool fee (creator% + 0.8% base) is claimed in one transaction.
 * In the same atomic transaction, the platform's 0.4% share is transferred
 * from the creator's wallet to the platform wallet.
 *
 * Net result for the creator: they receive their creatorTax% + 0.4% share.
 * Net result for the platform: receives the 0.4% share.
 */
export async function claimCreatorFees(
  params: ClaimFeesParams
): Promise<ClaimFeesResult> {
  const { poolAddress, wallet, connection, creatorFeePercent } = params;

  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const client = getDbcClient(connection);
  const pool = new PublicKey(poolAddress);

  try {
    // 1. Read the raw claimable amount to know how much the platform gets
    const metrics = await (client as any).state.getPoolFeeMetrics(pool);
    let rawClaimableLamports = 0;
    if (metrics?.current?.creatorQuoteFee) {
      const val = metrics.current.creatorQuoteFee;
      rawClaimableLamports = typeof val === 'object' && val.toString
        ? Number(val.toString())
        : Number(val ?? 0);
    }

    if (rawClaimableLamports <= 0) {
      throw new Error('No fees available to claim');
    }

    // 2. Build the Meteora claim transaction (claims FULL amount to creator wallet)
    const MAX_U64 = new BN('18446744073709551615');
    
    // The SDK requires 'creator' to match the pool's original creator to authorize the claim,
    // though the funds are automatically routed to the registered feeClaimer.
    const sdkCreatorProp = params.poolCreator ? new PublicKey(params.poolCreator) : wallet.publicKey;

    const transaction = await (client as any).creator.claimCreatorTradingFee({
      pool,
      creator: sdkCreatorProp,
      payer: wallet.publicKey,
      maxBaseAmount: MAX_U64,
      maxQuoteAmount: MAX_U64,
    });

    // 3. Calculate platform's share and add transfer in the same transaction
    //    Platform share = rawClaimable × platformFraction
    //    0% tax: platform gets 50% (0.4% of 0.8%)
    //    5% tax: platform gets 0.4 / (5 + 0.8) = 6.9% of feeClaimer amount
    const platformFraction = creatorFeePercent > 0 ? (0.4 / (creatorFeePercent + 0.8)) : 0.5; // 50% for 0% tax tokens
    const platformLamports = Math.floor(rawClaimableLamports * platformFraction);

    if (platformLamports > 0) {
      transaction.add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(PLATFORM_FEE_WALLET),
        lamports: platformLamports,
      }));
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = wallet.publicKey;

    const txSignature = await wallet.sendTransaction(transaction, connection, {
      skipPreflight: true,
      maxRetries: 3,
    });

    await confirmTx(txSignature, connection);

    return { txSignature };
  } catch (err: any) {
    if (err?.message?.includes('0x0') || err?.message?.includes('no fees')) {
      throw new Error('No fees available to claim');
    }
    throw err;
  }
}
