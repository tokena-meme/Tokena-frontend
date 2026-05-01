import { useEffect, useState } from 'react';
import { EvmTokenState, getEvmTokenState } from '@/lib/evm/pool-state';

export function useEvmPoolState(tokenAddress: string | null, chainKey: string | null) {
  const [state, setState] = useState<EvmTokenState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip polling entirely for null values
    if (!tokenAddress || !chainKey) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout;

    async function poll() {
      try {
        const newState = await getEvmTokenState(tokenAddress as string, chainKey as string);
        if (isMounted) {
          setState(newState);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('EVM Pool State Polling Error:', err);
      }

      if (isMounted) {
        timer = setTimeout(poll, 30000); // 30s poll rate to avoid rate limits on free RPCs
      }
    }

    setIsLoading(true);
    poll();

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [tokenAddress, chainKey]);

  return { state, isLoading };
}
