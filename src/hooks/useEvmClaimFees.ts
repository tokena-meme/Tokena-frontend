import { useState, useEffect, useCallback } from 'react';
import { Contract, formatEther, EventLog } from 'ethers';
import { useEvmWallet } from './useEvmWallet';
import { EVM_CHAINS } from '@/lib/evm/constants';
import { BondingCurveABI } from '@/lib/evm/abi';
import { getEvmProvider } from '@/lib/evm/provider';
import type { Launch } from '@/lib/supabase/queries';

export interface EvmClaimFeesResult {
  txHash: string;
}

export function useEvmClaimFees(
  evmLaunches: Launch[],
  userAddress: string | null | undefined
) {
  const evmWallet = useEvmWallet();
  const [claimableMap, setClaimableMap] = useState<Record<string, number>>({});
  const [totalClaimedMap, setTotalClaimedMap] = useState<Record<string, number>>({});
  const [loadingPools, setLoadingPools] = useState(true);
  const [claimingPool, setClaimingPool] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedPools, setClaimedPools] = useState<Set<string>>(new Set());
  const [sessionClaimed, setSessionClaimed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Stable serialization key so useCallback doesn't rely on array reference equality
  const launchKeys = evmLaunches.map(l => `${l.chain}:${l.mint_address}`).join(',');

  const refresh = useCallback(async () => {
    if (!evmLaunches.length || !userAddress) {
      setLoadingPools(false);
      setClaimableMap({});
      setTotalClaimedMap({});
      return;
    }
    
    console.log(`[useEvmClaimFees] Fetching fees for ${evmLaunches.length} EVM launches, wallet: ${userAddress}`);
    setLoadingPools(true);
    try {
      const cMap: Record<string, number> = {};
      const tMap: Record<string, number> = {};

      await Promise.all(
        evmLaunches.map(async (launch) => {
          if (!launch.chain || !launch.mint_address) return;
          const chainConfig = EVM_CHAINS[launch.chain];
          if (!chainConfig) return;

          try {
            const provider = getEvmProvider(launch.chain);
            const contract = new Contract(launch.mint_address, BondingCurveABI, provider);

            // 1. Fetch pending fees (simple view call, always works)
            const pendingWei = await contract.pendingFees(userAddress);
            const pendingEth = Number(formatEther(pendingWei));
            cMap[launch.mint_address] = pendingEth;

            // 2. Fetch historically claimed fees via FeesClaimed event logs
            //    Paginate in chunks of 49,000 blocks to stay under RPC limits
            let claimedEth = 0;
            try {
              const currentBlock = await provider.getBlockNumber();
              const CHUNK_SIZE = 49_000;
              // Only scan the last ~500k blocks (~2 months) to limit RPC calls
              const startBlock = Math.max(0, currentBlock - 500_000);
              const filter = contract.filters.FeesClaimed(userAddress);
              let totalClaimedWei = 0n;

              for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
                const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
                const logs = await contract.queryFilter(filter, from, to);
                for (const log of logs) {
                  if (log instanceof EventLog && log.args) {
                    totalClaimedWei += log.args[1];
                  } else {
                    const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
                    if (parsed) {
                      totalClaimedWei += parsed.args[1];
                    }
                  }
                }
              }
              claimedEth = Number(formatEther(totalClaimedWei));
            } catch (logErr) {
              console.warn(`[useEvmClaimFees] Log query failed for ${launch.symbol}, claimed history unavailable:`, logErr);
            }
            tMap[launch.mint_address] = claimedEth;

            if (pendingEth > 0 || claimedEth > 0) {
              console.log(`[useEvmClaimFees] ${launch.symbol} (${launch.chain}): pending=${pendingEth}, claimed=${claimedEth}`);
            }
            
          } catch (err) {
            console.warn(`[useEvmClaimFees] Failed to fetch fees for ${launch.mint_address} on ${launch.chain}:`, err);
            cMap[launch.mint_address] = 0;
            tMap[launch.mint_address] = 0;
          }
        })
      );

      setClaimableMap(cMap);
      setTotalClaimedMap(tMap);
      console.log(`[useEvmClaimFees] Done. ${Object.keys(cMap).length} tokens checked.`);
    } catch (err) {
      console.warn('[useEvmClaimFees] Top-level fetch error:', err);
    } finally {
      setLoadingPools(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchKeys, userAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function claim(launch: Launch): Promise<EvmClaimFeesResult | null> {
    if (!evmWallet.connected || !evmWallet.address) {
      throw new Error('EVM Wallet not connected');
    }
    if (!launch.mint_address || !launch.chain) {
      throw new Error('Invalid EVM launch');
    }
    
    if (evmWallet.chainId !== EVM_CHAINS[launch.chain].chainId) {
      throw new Error(`Please switch MetaMask to ${EVM_CHAINS[launch.chain].name} to claim this token's fees.`);
    }

    setClaimingPool(launch.mint_address);
    setError(null);

    try {
      const signer = await evmWallet.getSigner();
      if (!signer) throw new Error('EVM Signer not found');

      const contract = new Contract(launch.mint_address, BondingCurveABI, signer);
      
      const claimedAmount = claimableMap[launch.mint_address] ?? 0;
      
      const tx = await contract.claimFees();
      const receipt = await tx.wait();

      if (receipt && receipt.status === 1) {
        setClaimedPools((prev) => new Set(prev).add(launch.mint_address));
        setSessionClaimed((prev) => prev + claimedAmount);
        setClaimableMap((prev) => ({ ...prev, [launch.mint_address]: 0 }));
        setTotalClaimedMap((prev) => ({
          ...prev,
          [launch.mint_address]: (prev[launch.mint_address] ?? 0) + claimedAmount,
        }));
        return { txHash: receipt.hash };
      }
      throw new Error('Transaction failed');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to claim fees');
      return null;
    } finally {
      setClaimingPool(null);
    }
  }

  async function claimAll(): Promise<void> {
    if (!evmWallet.connected) throw new Error('EVM Wallet not connected');
    setClaimingAll(true);
    setError(null);

    const claimableLaunches = evmLaunches.filter((l) => (claimableMap[l.mint_address] ?? 0) > 0);

    for (const launch of claimableLaunches) {
      try {
        await claim(launch);
      } catch (err: any) {
        console.warn(`Failed to claim EVM pool ${launch.mint_address}:`, err);
        // Continuous execution across varying networks is complex as user must approve
        // network switches, so we just attempt them sequentially and skip failures.
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
