import { useEffect, useState, useRef } from 'react';
import { Contract, formatEther, formatUnits } from 'ethers';
import { BondingCurveABI } from '@/lib/evm/abi';
import { getEvmProvider } from '@/lib/evm/provider';
import { Trade } from '@/lib/supabase/queries';

const TRADES_CACHE = new Map<string, { data: Trade[]; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds cache

// Chains where eth_getLogs works reliably with free RPCs
const SUPPORTS_GET_LOGS = new Set(['ethereum', 'sepolia', 'base', 'arbitrum']);

/**
 * Hook to fetch Buy/Sell events from an EVM bonding curve contract on-chain.
 * For chains with reliable eth_getLogs (ETH, Base, Arbitrum, Sepolia): fetches historical + streams new.
 * For rate-limited chains (BSC): only streams new trades in real-time, falls back to Supabase for history.
 */
export function useEvmOnChainTrades(
  tokenAddress: string | null | undefined,
  chainKey: string | null | undefined,
  limit = 30
) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const listenerRef = useRef<Contract | null>(null);

  useEffect(() => {
    if (!tokenAddress || !chainKey) return;

    const provider = getEvmProvider(chainKey);
    const token = new Contract(tokenAddress, BondingCurveABI, provider);
    let cleanedUp = false;

    // Only fetch historical events on chains that support eth_getLogs reliably
    const fetchHistorical = async () => {
      if (!SUPPORTS_GET_LOGS.has(chainKey)) return; // Skip BSC — use Supabase fallback for history

      const cached = TRADES_CACHE.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setTrades(cached.data);
        return;
      }

      setIsLoading(true);
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 500);

        let buyEvents: any[] = [];
        let sellEvents: any[] = [];

        try {
          buyEvents = await token.queryFilter(token.filters.Buy(), fromBlock, currentBlock);
        } catch (err) {
          console.warn('Failed to fetch Buy events:', err);
        }

        try {
          sellEvents = await token.queryFilter(token.filters.Sell(), fromBlock, currentBlock);
        } catch (err) {
          console.warn('Failed to fetch Sell events:', err);
        }

        if (cleanedUp) return;

        const allEvents = [...buyEvents, ...sellEvents]
          .sort((a, b) => (b.blockNumber - a.blockNumber) || (b.transactionIndex - a.transactionIndex))
          .slice(0, limit);

        const parsed = parseEvents(allEvents, tokenAddress, chainKey);

        // Fetch block timestamps (limit to 5 to avoid rate limits)
        const blockNumbers = [...new Set(allEvents.map(e => e.blockNumber))];
        for (const bn of blockNumbers.slice(0, 5)) {
          try {
            const block = await provider.getBlock(bn);
            if (block) {
              for (const trade of parsed) {
                if (trade.slot === bn) {
                  trade.created_at = new Date(block.timestamp * 1000).toISOString();
                }
              }
            }
          } catch { /* skip */ }
        }

        if (!cleanedUp) {
          setTrades(parsed);
          TRADES_CACHE.set(tokenAddress, { data: parsed, timestamp: Date.now() });
        }
      } catch (err) {
        console.warn('useEvmOnChainTrades fetch error:', err);
      } finally {
        if (!cleanedUp) setIsLoading(false);
      }
    };

    // Stagger historical fetch to avoid racing with pool-state polling
    const delayTimer = setTimeout(() => fetchHistorical(), 2000);

    // Real-time event streaming — works on ALL chains (including BSC)
    try {
      const handleBuy = (buyer: string, ethAmount: bigint, tokenAmount: bigint, newPrice: bigint, event: any) => {
        if (cleanedUp) return;
        const txHash = event?.log?.transactionHash ?? `buy-${Date.now()}`;
        const newTrade = makeTrade(txHash, 'buy', buyer, ethAmount, tokenAmount, newPrice, event, tokenAddress, chainKey);
        setTrades(prev => {
          if (prev.some(t => t.tx_signature === txHash && t.type === 'buy')) return prev;
          return [newTrade, ...prev].slice(0, 50);
        });
      };

      const handleSell = (seller: string, tokenAmount: bigint, ethAmount: bigint, newPrice: bigint, event: any) => {
        if (cleanedUp) return;
        const txHash = event?.log?.transactionHash ?? `sell-${Date.now()}`;
        const newTrade = makeTrade(txHash, 'sell', seller, ethAmount, tokenAmount, newPrice, event, tokenAddress, chainKey);
        setTrades(prev => {
          if (prev.some(t => t.tx_signature === txHash && t.type === 'sell')) return prev;
          return [newTrade, ...prev].slice(0, 50);
        });
      };

      token.on('Buy', handleBuy);
      token.on('Sell', handleSell);
      listenerRef.current = token;

      return () => {
        cleanedUp = true;
        clearTimeout(delayTimer);
        token.off('Buy', handleBuy);
        token.off('Sell', handleSell);
        listenerRef.current = null;
      };
    } catch (err) {
      console.warn('Failed to subscribe to EVM trade events:', err);
      return () => {
        cleanedUp = true;
        clearTimeout(delayTimer);
      };
    }
  }, [tokenAddress, chainKey, limit]);

  return { trades, isLoading };
}

// Parse raw ethers event logs into Trade objects
function parseEvents(events: any[], tokenAddress: string, chainKey: string): Trade[] {
  return events.map((ev, idx) => {
    const args = ev.args;
    const isBuy = ev.fragment?.name === 'Buy';
    return {
      id: `${ev.transactionHash}-${ev.index}-${idx}`,
      launch_id: '',
      mint_address: tokenAddress,
      wallet_address: isBuy ? args.buyer : args.seller,
      type: isBuy ? 'buy' : 'sell',
      sol_amount: 0,
      token_amount: Number(formatUnits(args.tokenAmount, 18)),
      price_per_token: Number(args.newPrice) / 1e18,
      price_impact: null,
      fee_sol: null,
      tx_signature: ev.transactionHash,
      slot: ev.blockNumber,
      created_at: new Date().toISOString(),
      chain: chainKey,
      eth_amount: Number(formatEther(args.ethAmount)),
    } as Trade;
  });
}

// Create a single Trade object from a real-time event
function makeTrade(
  txHash: string, type: 'buy' | 'sell', wallet: string,
  ethAmount: bigint, tokenAmount: bigint, newPrice: bigint,
  event: any, tokenAddress: string, chainKey: string
): Trade {
  return {
    id: `${txHash}-${type}-${Date.now()}`,
    launch_id: '',
    mint_address: tokenAddress,
    wallet_address: wallet,
    type,
    sol_amount: 0,
    token_amount: Number(formatUnits(tokenAmount, 18)),
    price_per_token: Number(newPrice) / 1e18,
    price_impact: null,
    fee_sol: null,
    tx_signature: txHash,
    slot: event?.log?.blockNumber ?? null,
    created_at: new Date().toISOString(),
    chain: chainKey,
    eth_amount: Number(formatEther(ethAmount)),
  } as Trade;
}
