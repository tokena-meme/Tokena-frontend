import { useEffect, useState } from 'react';
import { subscribeToAllTrades, Trade, Launch } from '../../lib/supabase/queries';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import { formatSol, formatAddress } from '../../lib/utils';
import { Badge } from './Badge';

type FeedItem = Trade & { launch?: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null; idKey: string; };

export function GlobalTradeFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    const sub = subscribeToAllTrades((trade) => {
      setFeed((prev) => {
        const newItem = { ...trade, idKey: Math.random().toString(36).substr(2, 9) };
        const next = [newItem, ...prev].slice(0, 3); // Max 3 items on screen
        return next;
      });

      // Auto-remove after 4 seconds
      setTimeout(() => {
        setFeed((prev) => prev.slice(0, prev.length - 1));
      }, 4000);
    });

    return () => {
      sub.unsubscribe();
    };
  }, []);

  if (feed.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none">
      {feed.map((item) => (
        <div
          key={item.idKey}
          className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl flex items-center p-3 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto min-w-[280px]"
        >
          {item.launch?.image_url ? (
            <img src={ipfsToHttp(item.launch.image_url)} alt="Token" className="w-8 h-8 rounded-lg object-cover mr-3" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#111] flex-shrink-0 mr-3" />
          )}
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#888]">{formatAddress(item.wallet_address)}</span>
              {item.type === 'buy' ? (
                <span className="text-xs font-bold text-[#00D4AA]">bought</span>
              ) : (
                <span className="text-xs font-bold text-[#FF4444]">sold</span>
              )}
              <span className="text-xs font-bold text-white">
                {item.chain && item.chain !== 'solana'
                  ? `${(item.eth_amount ?? 0).toFixed(6)} ${item.chain === 'bsc' ? 'BNB' : 'ETH'}`
                  : `${formatSol(item.sol_amount ?? 0)} SOL`}
              </span>
            </div>
            <div className="text-xs font-mono text-[#555] mt-0.5">
              of <span className="text-white">${item.launch?.symbol ?? 'TOKEN'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
