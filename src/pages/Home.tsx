import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Rocket, BarChart3, ArrowRight, Zap, ChevronDown, Filter, Check, Copy } from 'lucide-react';
import { getLaunches, getPlatformStats, subscribeToAllTrades, subscribeToAllLaunches, getLatestGlobalTrade, Launch, Trade } from '../lib/supabase/queries';
import { TokenCard } from '../components/tokens/TokenCard';
import { Badge } from '../components/ui/Badge';
import { formatNumber, formatUsdCompact, formatAddress, formatSol } from '../lib/utils';
import { usePrices } from '../hooks/usePrices';
import { VISIBLE_EVM_CHAINS } from '../lib/evm/constants';
import { ChainIcon } from '../components/ui/ChainIcons';

export function Home() {
  const { solPrice } = usePrices();
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [hotLaunches, setHotLaunches] = useState<Launch[]>([]);
  const [migratedLaunches, setMigratedLaunches] = useState<Launch[]>([]);
  const [stats, setStats] = useState({ totalLaunches: 0, totalVolumeSol: 0, totalMigrations: 0 });
  const [loading, setLoading] = useState(true);
  const [latestTrade, setLatestTrade] = useState<(Trade & { launch?: Pick<Launch, 'name' | 'symbol' | 'image_url' | 'mint_address' | 'status'> | null }) | null>(null);
  const [chainFilter, setChainFilter] = useState<'all' | string>(() => {
    return localStorage.getItem('tokena_home_chain_filter') || 'all';
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('tokena_home_chain_filter', chainFilter);
  }, [chainFilter]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const chainQuery = chainFilter === 'all' ? undefined : chainFilter;

        const [all, hot, migrated, platformStats, initialLatestTrade] = await Promise.all([
          getLaunches({ limit: 12, orderBy: 'created_at', chain: chainQuery }),
          getLaunches({ limit: 6, orderBy: 'sol_raised', chain: chainQuery }),
          getLaunches({ limit: 4, status: 'migrated', chain: chainQuery }),
          getPlatformStats(),
          getLatestGlobalTrade(),
        ]);
        setLaunches(all);
        setHotLaunches(hot);
        setMigratedLaunches(migrated);
        setStats(platformStats);
        if (initialLatestTrade) setLatestTrade(initialLatestTrade);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();

    const tradeSub = subscribeToAllTrades((trade) => {
      setLatestTrade(trade);
    });

    const launchSub = subscribeToAllLaunches((launch) => {
      setLaunches(prev => {
        if (chainFilter !== 'all' && launch.chain !== chainFilter && (!launch.chain && chainFilter !== 'solana')) return prev;
        if (prev.some(l => l.mint_address === launch.mint_address)) return prev;
        return [launch, ...prev].slice(0, 12);
      });
    });

    return () => {
      tradeSub.unsubscribe();
      launchSub.unsubscribe();
    };
  }, [chainFilter]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-16 px-4">
        <div className="absolute inset-0 bg-gradient-radial from-[#F5A623]/5 via-transparent to-transparent" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245,166,35,0.06) 0%, transparent 70%)' }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F5A623]/10 border border-[#F5A623]/20 rounded-full mb-6 max-w-full overflow-hidden whitespace-nowrap">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] flex-shrink-0 animate-pulse-dot" />
            <span className="text-xs font-mono text-[#F5A623] truncate">
              {latestTrade ? (
                <>
                  <span className="text-white/60">{formatAddress(latestTrade.wallet_address)}</span>
                  <span className={`mx-1.5 font-bold ${latestTrade.type === 'buy' ? 'text-[#00D4AA]' : 'text-[#FF4444]'}`}>
                    {latestTrade.type === 'buy' ? 'bought' : 'sold'}
                  </span>
                  <span className="text-white">
                    {latestTrade.chain && latestTrade.chain !== 'solana'
                      ? `${(latestTrade.eth_amount ?? 0).toFixed(6)} ${latestTrade.chain === 'bsc' ? 'BNB' : 'ETH'}`
                      : `${formatSol(latestTrade.sol_amount)} SOL`}
                  </span>
                  <span className="text-white/60 ml-1.5">of ${latestTrade.launch?.symbol ?? 'TOKEN'}</span>
                </>
              ) : (
                "Powered by Tokena EVM Bonding Curves"
              )}
            </span>
          </div>


          <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-white leading-tight mb-6">
            Launch tokens that<br />
            <span className="font-display italic gradient-text">actually migrate.</span>
          </h1>

          <p className="text-lg text-[#555] font-mono max-w-xl mx-auto mb-10 leading-relaxed">
            Create a bonding curve token in seconds. When the ETH threshold is reached, your pool auto-migrates to Uniswap. Open-source smart contracts &amp; SDK — build your own launchpad.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/launch/create" className="btn-primary px-8 py-3.5 rounded-xl text-base inline-flex items-center gap-2">
              <Rocket size={18} />
              Launch a Token
            </Link>
            <Link to="/trending" className="btn-secondary px-8 py-3.5 rounded-xl text-base inline-flex items-center gap-2">
              <TrendingUp size={18} />
              View Trending
            </Link>
          </div>

        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[#111] bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 divide-x divide-[#111]">
            {[
              { label: 'Total Launches', value: formatNumber(stats.totalLaunches), icon: Rocket },
              { label: 'Total Volume', value: formatUsdCompact(stats.totalVolumeSol * solPrice), icon: BarChart3 },
              { label: 'Migrations', value: formatNumber(stats.totalMigrations), icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-6 py-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Icon size={14} className="text-[#F5A623]" />
                  <span className="text-xs font-mono text-[#444] uppercase tracking-wider">{label}</span>
                </div>
                <div className="text-2xl font-display font-bold text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Filter Dropdown */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 mb-2 flex justify-end relative z-10">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl text-sm font-mono text-white hover:bg-[#1a1a1a] transition-all"
          >
            <Filter size={14} className="text-[#888]" />
            {chainFilter === 'all' && <span>All Chains</span>}
            {chainFilter === 'solana' && <><ChainIcon chainKey="solana" size={14} /> <span>Solana</span></>}
            {VISIBLE_EVM_CHAINS.find(c => c.key === chainFilter) && (
              <><ChainIcon chainKey={chainFilter} size={14} /> <span>{VISIBLE_EVM_CHAINS.find(c => c.key === chainFilter)?.name}</span></>
            )}
            <ChevronDown size={14} className={`text-[#555] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full mt-2 w-48 right-0 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl shadow-xl overflow-hidden z-50">
              <button
                onClick={() => { setChainFilter('all'); setIsDropdownOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-mono text-left transition-colors hover:bg-[#1a1a1a] ${chainFilter === 'all' ? 'bg-[#1a1a1a] text-white' : 'text-[#888]'
                  }`}
              >
                <div className="w-[18px] flex justify-center"><Filter size={14} /></div>
                <span>All Chains</span>
                {chainFilter === 'all' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />}
              </button>

              <button
                onClick={() => { setChainFilter('solana'); setIsDropdownOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-mono text-left transition-colors hover:bg-[#1a1a1a] group ${chainFilter === 'solana' ? 'bg-[#1a1a1a] text-white' : 'text-[#888]'
                  }`}
              >
                <div className={`flex justify-center transition-all ${chainFilter !== 'solana' ? 'opacity-70 group-hover:opacity-100 grayscale group-hover:grayscale-0' : ''}`}>
                  <ChainIcon chainKey="solana" size={18} />
                </div>
                <span>Solana</span>
                {chainFilter === 'solana' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />}
              </button>

              {VISIBLE_EVM_CHAINS.map(c => {
                const isSelected = chainFilter === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => { setChainFilter(c.key); setIsDropdownOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-mono text-left transition-colors hover:bg-[#1a1a1a] group ${isSelected ? 'bg-[#1a1a1a] text-white' : 'text-[#888]'
                      }`}
                  >
                    <div className={`flex justify-center transition-all ${!isSelected ? 'opacity-70 group-hover:opacity-100 grayscale group-hover:grayscale-0' : ''}`}>
                      <ChainIcon chainKey={c.key} size={18} />
                    </div>
                    <span>{c.name}</span>
                    {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hot tokens */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp size={18} className="text-[#F5A623]" />
            <h2 className="text-xl font-display font-bold text-white">Hot right now</h2>
          </div>
          <Link to="/trending" className="flex items-center gap-1 text-sm text-[#555] hover:text-white font-mono transition-colors">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotLaunches.map((launch) => (
              <TokenCard key={launch.id} launch={launch} />
            ))}
          </div>
        )}
      </section>

      {/* Recently migrated */}
      {migratedLaunches.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Zap size={18} className="text-[#00D4AA]" />
            <h2 className="text-xl font-display font-bold text-white">Recently migrated</h2>
            <Badge variant="green">Finalized on Uniswap</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {migratedLaunches.map((launch) => (
              <TokenCard key={launch.id} launch={launch} />
            ))}
          </div>
        </section>
      )}

      {/* New launches */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse-dot" />
          <h2 className="text-xl font-display font-bold text-white">New launches</h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl skeleton" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {launches.map((launch) => (
              <TokenCard key={launch.id} launch={launch} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
