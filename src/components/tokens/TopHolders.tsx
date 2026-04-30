import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Users, ExternalLink } from 'lucide-react';
import { formatAddress } from '../../lib/utils';

interface Holder {
  address: string;
  owner: string;
  amount: number;
  percentage: number;
  isPool?: boolean;
}

interface TopHoldersProps {
  mintAddress: string;
  totalSupply: number;
  poolAddress?: string | null;
  connection: Connection;
}

// Simple in-memory cache to prevent redundant RPC calls
const HOLDERS_CACHE = new Map<string, { data: Holder[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function TopHolders({ mintAddress, totalSupply, poolAddress, connection }: TopHoldersProps) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchHolders() {
      if (!mintAddress) return;

      // Check cache first
      const cached = HOLDERS_CACHE.get(mintAddress);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setHolders(cached.data);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let result;
        try {
          result = await connection.getTokenLargestAccounts(new PublicKey(mintAddress));
        } catch (rpcErr) {
          console.warn('TopHolders: Primary RPC failed, trying official fallback...', rpcErr);
          try {
            const fallbackConn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
            result = await fallbackConn.getTokenLargestAccounts(new PublicKey(mintAddress));
          } catch (officialErr) {
            console.warn('TopHolders: Official fallback failed, trying Ankr...', officialErr);
            try {
              const ankrConn = new Connection('https://rpc.ankr.com/solana', 'confirmed');
              result = await ankrConn.getTokenLargestAccounts(new PublicKey(mintAddress));
            } catch (ankrErr) {
               console.warn('TopHolders: Ankr failed, trying Extrnode...', ankrErr);
               try {
                 const extrConn = new Connection('https://solana-mainnet.rpc.extrnode.com', 'confirmed');
                 result = await extrConn.getTokenLargestAccounts(new PublicKey(mintAddress));
               } catch (extrErr) {
                 console.warn('TopHolders: RPC methods failed. Trying SolanaFM API...');
                 try {
                   const response = await fetch(`https://api.solanafm.com/v0/tokens/${mintAddress}/holders?limit=20`);
                   if (!response.ok) throw new Error(`SolanaFM failed: ${response.status}`);
                   
                   const data = await response.json();
                   if (!data.results || data.results.length === 0) throw new Error('No holders found');

                   const sorted = data.results.map((h: any) => ({
                     address: h.account,
                     owner: h.owner || h.account,
                     amount: h.amount,
                     uiAmount: Number(h.amount) / Math.pow(10, 6),
                     decimals: 6,
                     isPool: h.owner === poolAddress
                   }));
                   
                   result = { value: sorted };
                   setError(null);
                 } catch (fmErr) {
                   console.error('TopHolders: All methods failed.', fmErr);
                   setError('Data Unavailable: Public RPC nodes are restricting this request.');
                   return;
                 }
               }
            }
          }
        }
        
        const largestAccounts = result;
        if (!largestAccounts || !largestAccounts.value) return;

        let accountInfos;
        try {
          accountInfos = await connection.getMultipleAccountsInfo(
            largestAccounts.value.map(a => a.address)
          );
        } catch (rpcErr) {
          console.warn('TopHolders: Account info fetch failed, trying official fallback...', rpcErr);
          try {
            const fallbackConn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
            accountInfos = await fallbackConn.getMultipleAccountsInfo(
              largestAccounts.value.map(a => a.address)
            );
          } catch (officialErr) {
            console.warn('TopHolders: Official account info fallback failed, trying Ankr...', officialErr);
            try {
              const ankrConn = new Connection('https://rpc.ankr.com/solana', 'confirmed');
              accountInfos = await ankrConn.getMultipleAccountsInfo(
                largestAccounts.value.map(a => a.address)
              );
            } catch (ankrErr) {
              console.warn('TopHolders: All account info fallbacks failed. Some owners may be missing.');
            }
          }
        }

        const processedHolders: Holder[] = largestAccounts.value.map((acc: any, i: number) => {
          const info = accountInfos?.[i];
          let owner = acc.owner || '';
          
          if (info && !owner) {
            try {
              // SPL Token account owner is at bytes 32-64
              owner = new PublicKey(info.data.slice(32, 64)).toBase58();
            } catch (e) {
              console.warn('Failed to parse owner for account', acc.address);
            }
          }

          const amount = acc.uiAmount ?? (Number(acc.amount) / Math.pow(10, acc.decimals || 6));
          const addrStr = typeof acc.address === 'string' ? acc.address : acc.address.toBase58();
          const isBondingCurve = addrStr === poolAddress || owner === poolAddress;
          
          return {
            address: addrStr,
            owner: owner || addrStr,
            amount,
            percentage: (amount / totalSupply) * 100,
            isPool: isBondingCurve
          };
        });

        if (mounted) {
          setHolders(processedHolders);
          HOLDERS_CACHE.set(mintAddress, { data: processedHolders, timestamp: Date.now() });
        }
      } catch (err) {
        console.error('TopHolders: fetch failed —', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchHolders();
    return () => { mounted = false; };
  }, [mintAddress, totalSupply, poolAddress, connection]);

  if (loading) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users size={13} className="text-[#F5A623]" />
          <h3 className="text-xs font-mono text-[#444] uppercase tracking-wider">Top 20 Holders</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 skeleton rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users size={13} className="text-[#F5A623]" />
        <h3 className="text-xs font-mono text-[#444] uppercase tracking-wider">Top 20 Holders</h3>
      </div>
      
      {error ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-[#FF4444] text-xs font-mono mb-2">{error}</div>
          <p className="text-[#333] text-[10px] max-w-[200px]">
            This often happens with public RPC nodes. Consider using a dedicated RPC endpoint.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {holders.map((holder, i) => (
            <div key={holder.address} className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[#333] w-4">{i + 1}.</span>
                <a 
                  href={`https://solscan.io/account/${holder.owner}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#888] hover:text-white truncate flex items-center gap-1"
                >
                  {formatAddress(holder.owner)}
                  {holder.isPool && <span className="text-[10px] bg-[#F5A623]/10 text-[#F5A623] px-1 rounded ml-1">Bonding Curve</span>}
                </a>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[#555]">{holder.percentage.toFixed(2)}%</span>
              </div>
            </div>
          ))}
          {holders.length === 0 && (
            <div className="text-center py-4 text-[#333] text-xs">No holders found</div>
          )}
        </div>
      )}
    </div>
  );
}
