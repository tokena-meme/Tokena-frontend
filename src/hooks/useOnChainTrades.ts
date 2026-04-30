import { useEffect, useState, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Trade } from '@/lib/supabase/queries';
import { getOnChainTrades } from '@/lib/meteora/on-chain-trades';

const TRADES_CACHE = new Map<string, { data: Trade[]; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds cache

/**
 * Hook to fetch and subscribe to on-chain trades for a specific pool.
 */
export function useOnChainTrades(
  poolAddress: string | null | undefined,
  mintAddress: string | null | undefined,
  limit = 20
) {
  const { connection } = useConnection();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!poolAddress || !mintAddress) return;

    const fetchInitial = async () => {
      // Check cache
      const cached = TRADES_CACHE.get(poolAddress!);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setTrades(cached.data);
        return;
      }

      setIsLoading(true);
      try {
        const initialTrades = await getOnChainTrades(poolAddress!, mintAddress!, connection, limit);
        setTrades(initialTrades);
        TRADES_CACHE.set(poolAddress!, { data: initialTrades, timestamp: Date.now() });
      } catch (err) {
        console.error('useOnChainTrades fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitial();

    // Subscribe to new logs for the pool address
    try {
      const poolPubKey = new PublicKey(poolAddress);
      subscriptionRef.current = connection.onLogs(
        poolPubKey,
        async (logs) => {
          // Check if it's a swap instruction (simple heuristic)
          if (logs.logs.some(l => l.includes('Instruction: Swap') || l.includes('Instruction: Buy') || l.includes('Instruction: Sell'))) {
            // Fetch the trade after a short delay to ensure transaction is indexed
            setTimeout(async () => {
                const latest = await getOnChainTrades(poolAddress, mintAddress, connection, 5);
                setTrades(prev => {
                  const newTrades = latest.filter(lt => !prev.some(pt => pt.id === lt.id));
                  return [...newTrades, ...prev].slice(0, 50);
                });
            }, 1000);
          }
        },
        'confirmed'
      );
    } catch (err) {
      console.error('Failed to subscribe to on-chain logs:', err);
    }

    return () => {
      if (subscriptionRef.current !== null) {
        connection.removeOnLogsListener(subscriptionRef.current);
      }
    };
  }, [poolAddress, mintAddress, connection, limit]);

  return { trades, isLoading };
}
