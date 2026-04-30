import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { PoolState, startPoolStatePolling } from '@/lib/meteora/pool-state';

// Check if an address is a valid Solana public key
function isValidAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

const POOL_CACHE = new Map<string, { data: PoolState; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

export function usePoolState(poolAddress: string | null) {
  const { connection } = useConnection();
  const [state, setState] = useState<PoolState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip polling entirely for null or invalid (mock) addresses
    if (!poolAddress || !isValidAddress(poolAddress)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Check cache
    const cached = POOL_CACHE.get(poolAddress);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setState(cached.data);
      setIsLoading(false);
    }

    const cleanup = startPoolStatePolling(
      poolAddress,
      connection,
      (newState) => {
        setState(newState);
        POOL_CACHE.set(poolAddress, { data: newState, timestamp: Date.now() });
        setIsLoading(false);
      },
      10000 // poll every 10s
    );

    return cleanup;
  }, [poolAddress, connection]);

  return { state, isLoading };
}
