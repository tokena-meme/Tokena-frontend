import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { getUserHoldings } from '../../lib/supabase/social-queries';
import { formatNumber, formatSol } from '../../lib/utils';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import type { HoldingItem } from '../../lib/supabase/types';

interface HoldingsGridProps {
  wallet: string;
}

export function HoldingsGrid({ wallet }: HoldingsGridProps) {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserHoldings(wallet)
      .then(setHoldings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <Wallet size={20} className="text-[#333]" />
        </div>
        <p className="text-[#444] font-mono text-sm">No holdings found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {holdings.map((holding) => {
        const pnlPercent = holding.total_buy_sol > 0
          ? ((holding.total_sell_sol - holding.total_buy_sol) / holding.total_buy_sol * 100)
          : 0;
        const isProfit = holding.realized_pnl >= 0;

        return (
          <div
            key={holding.mint_address}
            onClick={() => navigate(`/token/${holding.mint_address}`)}
            className="token-card bg-[#0d0d0d] rounded-xl p-4 cursor-pointer"
          >
            <div className="flex items-center gap-3 mb-3">
              {holding.token_image ? (
                <img
                  src={ipfsToHttp(holding.token_image)}
                  alt={holding.token_name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black text-sm font-bold font-display flex-shrink-0">
                  {holding.token_symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white font-ui truncate">{holding.token_name}</span>
                  <span className="text-xs font-mono text-[#555]">${holding.token_symbol}</span>
                </div>
                <div className="text-xs font-mono text-[#444]">
                  {formatNumber(holding.net_quantity)} tokens held
                </div>
              </div>
              <div className={`flex items-center gap-1 text-sm font-mono font-semibold ${isProfit ? 'text-[#00D4AA]' : 'text-[#FF4444]'}`}>
                {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {pnlPercent > 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#111]">
              <div>
                <div className="text-xs font-mono text-[#444] mb-0.5">Avg Buy</div>
                <div className="text-xs font-mono text-white">
                  {holding.avg_buy_price > 0 ? holding.avg_buy_price.toExponential(2) : '–'} SOL
                </div>
              </div>
              <div>
                <div className="text-xs font-mono text-[#444] mb-0.5">Total Bought</div>
                <div className="text-xs font-mono text-white">{formatSol(holding.total_buy_sol)} SOL</div>
              </div>
              <div>
                <div className="text-xs font-mono text-[#444] mb-0.5">Realized PnL</div>
                <div className={`text-xs font-mono font-semibold ${isProfit ? 'text-[#00D4AA]' : 'text-[#FF4444]'}`}>
                  {isProfit ? '+' : ''}{formatSol(holding.realized_pnl)} SOL
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
