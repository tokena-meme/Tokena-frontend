import { useEffect, useState, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getOnChainMcap } from '@/lib/meteora/pool-state';
import { usePrices } from './usePrices';

interface OnChainMcap {
  solRaised: number;
  marketCapSol: number;
  marketCapUsd: number;
}

// Global cache to avoid redundant RPC calls across components
const MCAP_CACHE = new Map<string, { data: OnChainMcap; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache

// Check if an address is a valid Solana public key
function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lightweight hook to fetch market cap directly from the on-chain bonding curve.
 * Polls every 30s. Returns null while loading or if pool address is invalid.
 *
 * Usage in TokenCard:
 *   const onChainMcap = useOnChainMcap(launch.dbc_pool_address);
 *   const marketCapUsd = onChainMcap?.marketCapUsd ?? getMcapUsd(launch.sol_raised, solPrice);
 */
export function useOnChainMcap(
  poolAddress: string | null | undefined,
  pollIntervalMs = 30_000
): OnChainMcap | null {
  const { connection } = useConnection();
  const { solPrice } = usePrices();
  const [mcap, setMcap] = useState<OnChainMcap | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Skip for null/invalid addresses or EVM tokens
    if (!poolAddress || !isValidAddress(poolAddress)) {
      setMcap(null);
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    const fetch = async () => {
      // Check cache
      const cached = MCAP_CACHE.get(poolAddress!);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        if (mountedRef.current) setMcap(cached.data);
        return;
      }

      try {
        const result = await getOnChainMcap(poolAddress!, connection, solPrice);
        if (mountedRef.current && result) {
          setMcap(result);
          MCAP_CACHE.set(poolAddress!, { data: result, timestamp: Date.now() });
        }
      } catch (err) {
        console.error('useOnChainMcap fetch error:', err);
      }
    };

    // Stagger initial fetch by 0–2s to avoid RPC burst when many cards mount
    const initialDelay = Math.random() * 2000;
    const timeoutId = setTimeout(() => {
      fetch();
      intervalId = setInterval(fetch, pollIntervalMs);
    }, initialDelay);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [poolAddress, connection, solPrice, pollIntervalMs]);

  return mcap;
}
