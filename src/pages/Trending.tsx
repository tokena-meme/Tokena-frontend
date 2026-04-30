import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Zap, Clock, BarChart3, Filter } from 'lucide-react';
import { getLaunches, subscribeToAllLaunches, Launch } from '../lib/supabase/queries';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { formatSol, formatNumber, formatAddress, timeAgo } from '../lib/utils';
import { ipfsToHttp } from '../lib/ipfs/pinata';

type FilterType = 'all' | 'new' | 'near-migration' | 'migrated';
type SortBy = 'sol_raised' | 'migration_progress' | 'created_at';

export function Trending() {
  const navigate = useNavigate();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [filtered, setFiltered] = useState<Launch[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('sol_raised');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLaunches({ limit: 100, orderBy: sortBy })
      .then(setLaunches)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Real-time listener for new deployments globally!
    const sub = subscribeToAllLaunches((newLaunch) => {
      setLaunches((prev) => {
        // Prevent strictly duplicating if already exists securely
        if (prev.some(l => l.mint_address === newLaunch.mint_address)) return prev;
        return [newLaunch, ...prev];
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [sortBy]);

  useEffect(() => {
    let result = [...launches];
    if (filter === 'new') result = result.filter((l) => !l.is_migrated);
    if (filter === 'near-migration') result = result.filter((l) => !l.is_migrated && l.migration_progress >= 70);
    if (filter === 'migrated') result = result.filter((l) => l.is_migrated);
    setFiltered(result);
  }, [launches, filter]);

  const filters: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'new', label: 'Active' },
    { id: 'near-migration', label: 'Near Migration' },
    { id: 'migrated', label: 'Migrated' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-white mb-2">
          Trending tokens.
        </h1>
        <p className="text-[#555] font-mono text-sm">Sort and filter all active bonding curve launches.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-mono transition-all border ${
                filter === f.id
                  ? 'border-[#F5A623] text-[#F5A623] bg-[#F5A623]/10'
                  : 'border-[#1a1a1a] text-[#555] hover:border-[#2a2a2a] hover:text-[#888]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter size={14} className="text-[#555]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="tokena-input text-sm px-3 py-1.5 rounded-lg font-mono"
          >
            <option value="sol_raised">Sort: Most Liquid</option>
            <option value="migration_progress">Sort: Migration Progress</option>
            <option value="created_at">Sort: Newest</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl skeleton" />
          ))}
        </div>
      ) : (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#111] text-xs font-mono text-[#444] uppercase tracking-wider">
            <span className="col-span-1">#</span>
            <span className="col-span-3">Token</span>
            <span className="col-span-3">Migration</span>
            <span className="col-span-2">Funds Raised</span>
            <span className="col-span-1">Tax</span>
            <span className="col-span-2 text-right">Created</span>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-[#444] font-mono text-sm">No tokens found.</div>
          ) : (
            filtered.map((launch, i) => (
              <div
                key={launch.id}
                className="grid grid-cols-12 gap-4 px-5 py-4 border-b border-[#0f0f0f] hover:bg-[#0f0f0f] cursor-pointer transition-colors items-center"
                onClick={() => navigate(`/token/${launch.mint_address}`)}
              >
                <span className="col-span-1 text-xs font-mono text-[#444]">{i + 1}</span>
                <div className="col-span-3 flex items-center gap-3">
                  {launch.image_url ? (
                    <img src={ipfsToHttp(launch.image_url)} alt={launch.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
                      {launch.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white font-ui truncate">{launch.name}</span>
                      {launch.is_featured && <Badge variant="amber">Hot</Badge>}
                    </div>
                    <span className="text-xs font-mono text-[#555]">${launch.symbol}</span>
                  </div>
                </div>
                <div className="col-span-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className={launch.is_migrated ? 'text-[#00D4AA]' : 'text-[#888]'}>
                      {launch.migration_progress.toFixed(1)}%
                    </span>
                    {launch.is_migrated && <Badge variant="green"><Zap size={8} /> Migrated</Badge>}
                  </div>
                  <ProgressBar value={launch.migration_progress} migrated={launch.is_migrated} />
                </div>
                <div className="col-span-2">
                  <span className="text-sm font-mono text-white">{formatSol(launch.sol_raised)}</span>
                  <span className="text-xs font-mono text-[#444] ml-1">{launch.chain === 'solana' || !launch.chain ? 'SOL' : 'ETH'}</span>
                </div>
                <div className="col-span-1">
                  {(() => {
                    const isEvm = launch.chain !== 'solana' && launch.chain != null;
                    const evmTaxSum = isEvm && launch.is_tax_token 
                      ? (launch.dev_buy_fee_percent ?? 0) + (launch.marketing_buy_fee_percent ?? 0) 
                      : 0;
                    const launchTaxPct = isEvm ? evmTaxSum : (launch.creator_fee_percent ?? 0);

                    return launchTaxPct > 0 ? (
                      <span className={`text-xs font-mono font-medium ${launchTaxPct > 3 ? 'text-[#FF4444]' : 'text-[#4A9EFF]'}`}>
                        {launchTaxPct}%
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-[#333]">—</span>
                    );
                  })()}
                </div>
                <div className="col-span-2 text-right text-xs font-mono text-[#444]">
                  {timeAgo(launch.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
