import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Trade, subscribeToTrades } from '../../lib/supabase/queries';
import { formatSol, formatNumber, formatAddress, timeAgo } from '../../lib/utils';

interface LiveTradeFeedProps {
  initialTrades: Trade[];
  mintAddress: string;
  nativeSymbol?: string;
  disableSupabase?: boolean;
}

export function LiveTradeFeed({ initialTrades, mintAddress: _mintAddress, nativeSymbol = 'SOL', disableSupabase = false }: LiveTradeFeedProps) {
  const [trades, setTrades] = useState<Trade[]>(initialTrades);

  useEffect(() => {
    setTrades(initialTrades);
  }, [initialTrades]);

  useEffect(() => {
    if (disableSupabase) return;
    
    const sub = subscribeToTrades(_mintAddress, (newTrade) => {
      setTrades((prev) => {
        if (prev.some(t => t.id === newTrade.id)) return prev;
        return [newTrade, ...prev];
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [_mintAddress]);

  if (!trades.length) {
    return (
      <div className="flex items-center justify-center py-12 text-[#444] text-sm font-mono">
        No trades yet. Be the first to buy!
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-[#111]">
      <div className="grid grid-cols-5 gap-2 py-2 px-3 text-xs font-mono text-[#444] uppercase tracking-wider">
        <span>Type</span>
        <span>{nativeSymbol}</span>
        <span>Tokens</span>
        <span>Wallet</span>
        <span className="text-right">Time</span>
      </div>
      {trades.map((trade) => (
        <div key={trade.id} className="grid grid-cols-5 gap-2 py-2.5 px-3 text-xs font-mono hover:bg-[#0f0f0f] transition-colors trade-entry">
          <div className="flex items-center gap-1">
            {trade.type === 'buy' ? (
              <>
                <ArrowUpRight size={12} className="text-[#00D4AA]" />
                <span className="text-[#00D4AA] font-semibold">BUY</span>
              </>
            ) : (
              <>
                <ArrowDownRight size={12} className="text-[#FF4444]" />
                <span className="text-[#FF4444] font-semibold">SELL</span>
              </>
            )}
          </div>
          <span className="text-[#888]">{formatSol(Number((trade as any).eth_amount ?? trade.sol_amount))} {nativeSymbol}</span>
          <span className="text-[#888]">{Number(trade.token_amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="text-[#555]">{formatAddress(trade.wallet_address)}</span>
          <span className="text-right text-[#444]">{timeAgo(trade.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
