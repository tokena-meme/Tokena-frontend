import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { claimCreatorFees, getClaimableFeesForPools, ClaimableInfo, ClaimFeesResult } from '@/lib/meteora/claim-fees';

/**
 * @param poolAddresses   - List of pool addresses to monitor
 * @param creatorFeeMap   - Map of poolAddress → creatorFeePercent (e.g. { "abc...": 5 })
 *                          Needed so we show only the creator's share and hide platform 0.4%.
 * @param poolCreatorMap  - Map of poolAddress → original pool creator pubkey string.
 */
export function useClaimFees(
  poolAddresses: string[],
  creatorFeeMap: Record<string, number> = {},
  poolCreatorMap: Record<string, string> = {},
) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [claimableMap, setClaimableMap] = useState<Record<string, number>>({});
  const [totalClaimedMap, setTotalClaimedMap] = useState<Record<string, number>>({});
  const [loadingPools, setLoadingPools] = useState(true);
  const [claimingPool, setClaimingPool] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedPools, setClaimedPools] = useState<Set<string>>(new Set());
  const [sessionClaimed, setSessionClaimed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stable key for creatorFeeMap
  const feeMapKey = JSON.stringify(creatorFeeMap);

  // Fetch claimable amounts for all pools
  const refresh = useCallback(async () => {
    if (poolAddresses.length === 0) {
      setLoadingPools(false);
      return;
    }
    setLoadingPools(true);
    try {
      const results = await getClaimableFeesForPools(poolAddresses, connection, creatorFeeMap);
      const cMap: Record<string, number> = {};
      const tMap: Record<string, number> = {};
      results.forEach((r) => {
        cMap[r.poolAddress] = r.claimableSol;
        tMap[r.poolAddress] = r.totalClaimedSol;
      });
      setClaimableMap(cMap);
      setTotalClaimedMap(tMap);
    } catch {
      // Silently fail — amounts will show as 0
    } finally {
      setLoadingPools(false);
    }
  }, [poolAddresses.join(','), connection, feeMapKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function claim(poolAddress: string): Promise<ClaimFeesResult | null> {
    if (!wallet.connected) throw new Error('Wallet not connected');
    setClaimingPool(poolAddress);
    setError(null);

    try {
      const claimedAmount = claimableMap[poolAddress] ?? 0;
      const creatorFeePct = creatorFeeMap[poolAddress] ?? 0;
      const poolCreator = poolCreatorMap[poolAddress];

      const result = await claimCreatorFees({
        poolAddress,
        wallet,
        connection,
        creatorFeePercent: creatorFeePct,
        poolCreator,
      });

      if (result) {
        setClaimedPools((prev) => new Set(prev).add(poolAddress));
        setSessionClaimed((prev) => prev + claimedAmount);
        setClaimableMap((prev) => ({ ...prev, [poolAddress]: 0 }));
        setTotalClaimedMap((prev) => ({
          ...prev,
          [poolAddress]: (prev[poolAddress] ?? 0) + claimedAmount,
        }));
      }
      return result;
    } catch (err: any) {
      setError(err?.message ?? 'Failed to claim fees');
      return null;
    } finally {
      setClaimingPool(null);
    }
  }

  /**
   * Claim all pools that have claimable fees, one by one.
   */
  async function claimAll(): Promise<void> {
    if (!wallet.connected) throw new Error('Wallet not connected');
    setClaimingAll(true);
    setError(null);

    const claimablePools = poolAddresses.filter((addr) => (claimableMap[addr] ?? 0) > 0);

    for (const poolAddr of claimablePools) {
      try {
        await claim(poolAddr);
      } catch (err: any) {
        console.warn(`Failed to claim pool ${poolAddr}:`, err);
        // Continue with next pool
      }
    }

    setClaimingAll(false);
  }

  const totalClaimable = Object.values(claimableMap).reduce((s, v) => s + v, 0);
  const totalClaimed = Object.values(totalClaimedMap).reduce((s, v) => s + v, 0);

  return {
    claim,
    claimAll,
    claimableMap,
    totalClaimable,
    totalClaimed,
    totalClaimedMap,
    sessionClaimed,
    claimedPools,
    claimingPool,
    claimingAll,
    loadingPools,
    error,
    refresh,
  };
}
