import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ExternalLink, Twitter, Send, Globe, ArrowLeft, Users, BarChart3, Percent, Share2, Copy, Check } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getLaunchByMint, getTradesByMint, getRecentTradesByMint, subscribeToTrades, Launch, Trade } from '../lib/supabase/queries';
import { useFavorites } from '../hooks/useFavorites';
import { Star } from 'lucide-react';
import { McapChart } from '../components/charts/McapChart';
import { TradePanel } from '../components/tokens/TradePanel';
import { LiveTradeFeed } from '../components/tokens/LiveTradeFeed';
import { MigrationBanner } from '../components/tokens/MigrationBanner';
import { TokenComments } from '../components/tokens/TokenComments';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Badge } from '../components/ui/Badge';
import { formatSol, formatNumber, formatAddress, timeAgo, formatUsdCompact, formatTelegramLink, formatWebsiteLink } from '../lib/utils';
import { getMcapUsd, formatMcapUsd, formatTokenPriceSol, formatTokenPriceUsd, getMigrationProgress } from '../lib/utils/marketcap';
import { ipfsToHttp } from '../lib/ipfs/pinata';
import { usePoolState } from '../hooks/usePoolState';
import { useOnChainMcap } from '../hooks/useOnChainMcap';
import { useOnChainTrades } from '../hooks/useOnChainTrades';
import { useEvmPoolState } from '../hooks/useEvmPoolState';
import { usePrices } from '../hooks/usePrices';
import { EVM_CHAINS } from '../lib/evm/constants';
import { ChainIcon } from '../components/ui/ChainIcons';
import { TopHolders } from '../components/tokens/TopHolders';
import { getConnection } from '../lib/solana/connection';



export function TokenDetail() {
  const connection = useMemo(() => getConnection(), []);
  const { mint } = useParams<{ mint: string }>();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { solPrice, ethPrice, bnbPrice } = usePrices();
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const [activeTab, setActiveTab] = useState<'pool' | 'trades' | 'holders'>('pool');

  // Favorites logic
  const { isFavorited, toggleFavorite } = useFavorites(publicKey?.toString(), mint);

  const isEvm = launch?.chain !== 'solana' && launch?.chain != null;
  const targetChain = isEvm ? EVM_CHAINS[launch.chain!] : null;
  const nativeSymbol = isEvm ? (targetChain?.nativeCurrency.symbol || 'ETH') : 'SOL';

  const nativePriceUsd = useMemo(() => {
    if (!isEvm) return solPrice;
    if (launch?.chain === 'bsc') return bnbPrice;
    return ethPrice;
  }, [isEvm, launch?.chain, solPrice, ethPrice, bnbPrice]);

  // Live pool state polling
  const { state: solPoolState } = usePoolState(isEvm ? null : (launch?.dbc_pool_address ?? null));
  const { state: evmPoolState } = useEvmPoolState(isEvm ? launch?.mint_address ?? null : null, isEvm ? launch?.chain! : null);

  useEffect(() => {
    if (!mint) return;
    setLoading(true);

    Promise.all([
      getLaunchByMint(mint),
      getTradesByMint(mint, 500),
      getRecentTradesByMint(mint, 50),
    ]).then(([l, t, r]) => {
      setLaunch(l);
      setAllTrades(t);
      setRecentTrades(r);
    }).catch(console.error)
      .finally(() => setLoading(false));

    const sub = subscribeToTrades(mint, (newTrade) => {
      setRecentTrades((prev) => [newTrade, ...prev.slice(0, 49)]);
      setAllTrades((prev) => [...prev, newTrade]);
    });
    subRef.current = sub as any;

    return () => { subRef.current?.unsubscribe(); };
  }, [mint]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out ${launch?.name} ($${launch?.symbol}) on Tokena`,
          text: `Buy ${launch?.name} on Tokena's open-source EVM bonding curve!`,
          url: window.location.href,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      handleCopy();
    }
  };

  // Use pool state for migration progress if available
  // On-chain solRaised comes from quoteReserve (actual SOL in the bonding curve)
  const nativeRaised = isEvm
    ? (evmPoolState?.ethBalance ?? launch?.eth_raised ?? 0)
    : (solPoolState?.solRaised ?? launch?.sol_raised ?? 0);

  // On-chain market cap from bonding curve (Solana only)
  const onChainMcap = useOnChainMcap(!isEvm ? (launch?.dbc_pool_address ?? null) : null);
  const onChainMcapUsd = onChainMcap?.marketCapUsd ?? null;

  // Live on-chain trades for Solana
  const { trades: solOnChainTrades } = useOnChainTrades(
    !isEvm ? (launch?.dbc_pool_address ?? null) : null,
    !isEvm ? (launch?.mint_address ?? null) : null
  );

  const displayTrades = !isEvm && solOnChainTrades.length > 0 ? solOnChainTrades : recentTrades;

  const isMigrated = isEvm
    ? (evmPoolState?.thresholdReached ?? launch?.is_migrated ?? false)
    : (solPoolState?.isMigrated ?? launch?.is_migrated ?? false);

  const threshold = isEvm 
    ? (evmPoolState?.ethThreshold && evmPoolState.ethThreshold > 0 ? evmPoolState.ethThreshold : (launch?.migration_threshold_sol ?? 0.5))
    : (launch?.migration_threshold_sol ?? 25);

  const migrationProgress = Math.min(100, Math.max(0, (nativeRaised / threshold) * 100));

  const taxPct = isEvm
    ? (evmPoolState ? (evmPoolState.devBuyFeePercent + evmPoolState.marketingBuyFeePercent) : ((launch?.dev_buy_fee_percent ?? 0) + (launch?.marketing_buy_fee_percent ?? 0)))
    : (launch?.creator_fee_percent ?? 0);

  const currentPrice = isEvm
    ? (evmPoolState?.currentPriceEth ?? (recentTrades.length > 0 ? Number(recentTrades[0].price_per_token) : Number(launch?.initial_price_sol)))
    : (solPoolState?.currentPrice ?? (recentTrades.length > 0 ? Number(recentTrades[0].price_per_token) : Number(launch?.initial_price_sol)));

  const liveMcapUsd = useMemo(() => {
    if (isEvm) return (launch?.total_supply ?? 0) * (currentPrice ?? 0) * nativePriceUsd;
    return onChainMcapUsd ?? getMcapUsd(nativeRaised, nativePriceUsd);
  }, [isEvm, launch?.total_supply, currentPrice, nativePriceUsd, onChainMcapUsd, nativeRaised]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-20 rounded-xl skeleton" />
            <div className="h-80 rounded-xl skeleton" />
          </div>
          <div className="h-96 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-[#555] font-mono text-sm mb-4">Token not found.</p>
        <Link to="/" className="text-[#F5A623] font-mono text-sm hover:underline">← Back to Explore</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-mono text-[#444] hover:text-white transition-colors mb-5">
        <ArrowLeft size={12} /> Back
      </Link>

      {isMigrated && launch.meteora_pool_address && (
        <div className="mb-4">
          <MigrationBanner meteoraPoolAddress={launch.meteora_pool_address} symbol={launch.symbol} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: chart + trades */}
        <div className="lg:col-span-2 space-y-4">
          {/* Token header */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-shrink-0">
                {launch.image_url ? (
                  <img src={ipfsToHttp(launch.image_url)} alt={launch.name} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black text-xl font-bold font-display">
                    {launch.symbol.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl font-display font-bold text-white">{launch.name}</h1>
                  <span className="font-mono text-[#555] text-sm">${launch.symbol}</span>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!connected) {
                        setVisible(true);
                      } else {
                        toggleFavorite();
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all ${isFavorited
                        ? 'text-[#F5A623] bg-[#F5A623]/10 border border-[#F5A623]/20'
                        : 'text-[#333] hover:text-[#555] bg-[#111] border border-[#1a1a1a]'
                      }`}
                    title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    <Star size={16} fill={isFavorited ? 'currentColor' : 'none'} />
                  </button>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(!launch.chain || launch.chain === 'solana') ? (
                      <Badge variant="default"><span className="flex items-center gap-1"><ChainIcon chainKey="solana" size={10} /> SOL</span></Badge>
                    ) : (
                      <Badge variant={launch.chain === 'bsc' ? 'amber' : 'blue'}>
                        <span className="flex items-center gap-1"><ChainIcon chainKey={launch.chain} size={10} /> {EVM_CHAINS[launch.chain]?.shortName ?? launch.chain.toUpperCase()}</span>
                      </Badge>
                    )}
                    {isMigrated ? <Badge variant="green">Migrated</Badge> : <Badge variant="default">Active</Badge>}
                    {launch.is_featured && <Badge variant="amber">Featured</Badge>}
                    {taxPct > 0 && (
                      <Badge variant={taxPct > 3 ? 'red' : 'blue'}>
                        Tax: {taxPct}%
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-display font-bold text-white font-mono">{formatTokenPriceUsd(currentPrice * nativePriceUsd)}</span>
                  <span className="text-xs font-mono text-[#444]">{formatTokenPriceSol(currentPrice)} {nativeSymbol}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-[#333]">Created by</span>
                  <Link to={`/profile/${launch.creator_wallet}`} className="text-[#F5A623] underline underline-offset-2 transition-colors hover:text-[#FF6B35]">
                    {launch.creator_profile?.display_name || launch.creator_profile?.username || formatAddress(launch.creator_wallet)}
                  </Link>
                </div>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {launch.twitter && (
                    <a href={`https://twitter.com/${launch.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-white transition-colors" title={`Twitter: ${launch.twitter}`}>
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-current">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                  )}
                  {launch.telegram && (
                    <a href={formatTelegramLink(launch.telegram)} target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-[#888] transition-colors" title="Telegram">
                      <Send size={18} />
                    </a>
                  )}
                  {launch.website && (
                    <a href={formatWebsiteLink(launch.website)} target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-[#888] transition-colors" title="Website">
                      <Globe size={18} />
                    </a>
                  )}
                  <a href={isEvm ? `${targetChain?.explorerUrl}/token/${launch.mint_address}` : `https://solscan.io/token/${launch.mint_address}`} target="_blank" rel="noopener noreferrer" className="text-[#555] hover:text-[#888] transition-colors" title={isEvm ? "Explorer" : "Solscan"}>
                    <ExternalLink size={18} />
                  </a>

                  {/* Share/Copy Actions */}
                  <div className="flex items-center gap-4 pl-4 border-l border-[#1a1a1a]">
                    <button
                      onClick={handleCopy}
                      className={`transition-colors ${copied ? 'text-[#00D4AA]' : 'text-[#555] hover:text-white'}`}
                      title="Copy URL"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button
                      onClick={handleShare}
                      className="text-[#555] hover:text-white transition-colors"
                      title="Share Token"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {launch.description && (
              <p className="text-sm text-[#555] font-mono mt-3 border-t border-[#111] pt-3">{launch.description}</p>
            )}
          </div>

          {/* Chart */}
          <McapChart
            mintAddress={launch.mint_address}
            launchCreatedAt={launch.created_at}
            currentSolRaised={nativeRaised}
            solPriceUsd={nativePriceUsd}
            tokenColor="#F5A623"
            symbol={launch.symbol}
            nativeSymbol={nativeSymbol}
            isEvm={isEvm}
            currentMcapUsd={liveMcapUsd}
            launchMcapUsd={isEvm ? ((launch.total_supply ?? 0) * (launch.initial_price_sol ?? 0) * nativePriceUsd) : undefined} 
            migrationMcapUsd={isEvm && evmPoolState?.ethThreshold ? ((evmPoolState.ethThreshold / launch.total_supply) * launch.total_supply * nativePriceUsd) : undefined} 
            progressPercent={migrationProgress}
            totalSupply={launch.total_supply}
            poolAddress={launch.dbc_pool_address}
          />

          {/* Migration progress — driven by live pool state */}
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-[#F5A623]" />
                <span className="text-sm font-semibold text-white font-ui">Migration Progress</span>
              </div>
              <span className={`text-sm font-mono font-semibold ${isMigrated ? 'text-[#00D4AA]' : 'text-[#F5A623]'}`}>
                {migrationProgress.toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={migrationProgress} migrated={isMigrated} className="mb-2" />
            <div className="flex justify-between text-xs font-mono text-[#444]">
              <span>{formatSol(nativeRaised)} {nativeSymbol} raised</span>
              <span>Target: {threshold} {nativeSymbol}</span>
            </div>
          </div>

          {/* Token stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Supply', value: formatNumber(launch.total_supply) },
              { label: 'Favorites', value: formatNumber(launch.favorites_count ?? 0) },
              { label: 'Creator', value: launch.creator_profile?.display_name || launch.creator_profile?.username || formatAddress(launch.creator_wallet), link: `/profile/${launch.creator_wallet}` },
              { label: 'Trades', value: allTrades.length.toString() },
            ].map(({ label, value, link }: any) => (
              <div key={label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-3">
                <div className="text-xs font-mono text-[#444] mb-1">{label}</div>
                {link ? (
                  <Link to={link} className="text-sm font-mono text-[#F5A623] hover:underline">{value}</Link>
                ) : (
                  <div className="text-sm font-mono text-white">{value}</div>
                )}
              </div>
            ))}
          </div>

          {/* Buy/Sell Panel - Mobile only (Above Tabs) */}
          <div className="lg:hidden mb-6">
            <TradePanel launch={launch} />
          </div>

          {/* Mobile Tabs Switcher */}
          <div className="lg:hidden flex border-b border-[#1a1a1a] mb-4">
            {[
              { id: 'pool', label: 'Pool Info' },
              { id: 'trades', label: 'Live Trades' },
              { id: 'holders', label: 'Holders' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 text-xs font-mono transition-colors ${
                  activeTab === tab.id 
                    ? 'text-[#F5A623] border-b-2 border-[#F5A623] bg-[#F5A623]/5' 
                    : 'text-[#444] hover:text-[#888]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Live trade feed - Hidden on mobile if not active tab */}
          <div className={`${activeTab !== 'trades' ? 'hidden lg:block' : ''} bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden mb-4`}>
            <div className="px-4 py-3 border-b border-[#111] flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse-dot" />
              <span className="text-sm font-semibold text-white font-ui">Live Trades (On-Chain)</span>
            </div>
            <LiveTradeFeed initialTrades={displayTrades} mintAddress={launch.mint_address} nativeSymbol={nativeSymbol} disableSupabase={!isEvm} />
          </div>

          {/* Pool info - Mobile only (within tabs) */}
          {(launch.dbc_pool_address || isEvm) && (
            <div className={`${activeTab !== 'pool' ? 'flex lg:hidden' : 'lg:hidden'} bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 mb-4 ${activeTab !== 'pool' ? 'hidden' : ''}`}>
               <div className="w-full">
                <h3 className="text-xs font-mono text-[#444] uppercase tracking-wider mb-3">Pool Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">{isEvm ? 'Contract' : 'DBC Pool'}</span>
                    <a href={isEvm ? `${targetChain?.explorerUrl}/address/${launch.mint_address}` : `https://solscan.io/account/${launch.dbc_pool_address}`} target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white flex items-center gap-1">
                      {formatAddress((isEvm ? launch.mint_address : launch.dbc_pool_address) || '')} <ExternalLink size={9} />
                    </a>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">DEX Pool</span>
                    <a href={isEvm ? `https://app.uniswap.org/explore/pools/${launch.meteora_pool_address}` : `https://solscan.io/account/${launch.meteora_pool_address}`} target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:opacity-80 flex items-center gap-1">
                      {formatAddress(launch.meteora_pool_address || '')} <ExternalLink size={9} />
                    </a>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">Current Price</span>
                    <span className="text-[#888]">{formatTokenPriceUsd(currentPrice * nativePriceUsd)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">Market Cap</span>
                    <span className="text-[#888]">
                      {formatMcapUsd(isEvm ? (launch.total_supply * currentPrice * nativePriceUsd) : (onChainMcapUsd ?? getMcapUsd(nativeRaised, nativePriceUsd)))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">ATH</span>
                    <span className="text-[#00D4AA]">
                      {formatMcapUsd(launch.ath_mcap_usd ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">Volume</span>
                    <span className="text-[#888]">
                      {formatUsdCompact((launch.volume_sol ?? 0) * nativePriceUsd)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">Threshold</span>
                    <span className="text-[#888]">{threshold} {nativeSymbol}</span>
                  </div>
                </div>

                {/* Tax - Mobile (Under Pool Info) */}
                <div className="mt-4 pt-4 border-t border-[#111]">
                  <div className="flex items-center gap-2 mb-2">
                    <Percent size={11} className="text-[#4A9EFF]" />
                    <h3 className="text-[10px] font-mono text-[#444] uppercase tracking-wider">Tax</h3>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-[#555]">Fee per trade</span>
                    <span className={taxPct > 0 ? (taxPct > 3 ? 'text-[#FF4444]' : 'text-[#4A9EFF]') : 'text-[#888]'}>
                      {taxPct}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Holders - Mobile only (within tabs) */}
          {!isEvm && (
            <div className={`lg:hidden mb-4 ${activeTab !== 'holders' ? 'hidden' : ''}`}>
              <TopHolders 
                mintAddress={launch.mint_address}
                totalSupply={launch.total_supply}
                poolAddress={launch.dbc_pool_address}
                connection={connection}
              />
            </div>
          )}

        </div>

        {/* Right: info panel */}
        <div className="space-y-4">
          <div className="hidden lg:block">
            <TradePanel launch={launch} />
          </div>
          {/* Pool info */}
          {/* Pool info */}
          {/* Pool info - Desktop only */}
          {(launch.dbc_pool_address || isEvm) && (
            <div className="hidden lg:block bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
              <h3 className="text-xs font-mono text-[#444] uppercase tracking-wider mb-3">Pool Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">{isEvm ? 'Contract' : 'DBC Pool'}</span>
                  <a href={isEvm ? `${targetChain?.explorerUrl}/address/${launch.mint_address}` : `https://solscan.io/account/${launch.dbc_pool_address}`} target="_blank" rel="noopener noreferrer" className="text-[#888] hover:text-white flex items-center gap-1">
                    {formatAddress((isEvm ? launch.mint_address : launch.dbc_pool_address) || '')} <ExternalLink size={9} />
                  </a>
                </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#555]">DEX Pool</span>
                    <a href={isEvm ? `https://app.uniswap.org/explore/pools/${launch.meteora_pool_address}` : `https://solscan.io/account/${launch.meteora_pool_address}`} target="_blank" rel="noopener noreferrer" className="text-[#00D4AA] hover:opacity-80 flex items-center gap-1">
                      {formatAddress(launch.meteora_pool_address || '')} <ExternalLink size={9} />
                    </a>
                  </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">Current Price</span>
                  <span className="text-[#888]">{formatTokenPriceUsd(currentPrice * nativePriceUsd)}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">Market Cap</span>
                  <span className="text-[#888]">
                    {formatMcapUsd(isEvm ? (launch.total_supply * currentPrice * nativePriceUsd) : (onChainMcapUsd ?? getMcapUsd(nativeRaised, nativePriceUsd)))}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">ATH</span>
                  <span className="text-[#00D4AA]">
                    {formatMcapUsd(launch.ath_mcap_usd ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">Volume</span>
                  <span className="text-[#888]">
                    {formatUsdCompact((launch.volume_sol ?? 0) * nativePriceUsd)}
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-[#555]">Threshold</span>
                  <span className="text-[#888]">{threshold} {nativeSymbol}</span>
                </div>
              </div>

              {/* Tax - Desktop (Under Pool Info) */}
              <div className="mt-4 pt-4 border-t border-[#111]">
                <div className="flex items-center gap-2 mb-2">
                  <Percent size={11} className="text-[#4A9EFF]" />
                  <h3 className="text-[10px] font-mono text-[#444] uppercase tracking-wider">Tax</h3>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-[#555]">Fee per trade</span>
                  <span className={taxPct > 0 ? (taxPct > 3 ? 'text-[#FF4444]' : 'text-[#4A9EFF]') : 'text-[#888]'}>
                    {taxPct}%
                  </span>
                </div>
              </div>
            </div>
          )}




          {/* Top Holders */}
          {/* Top Holders - Desktop only */}
          {!isEvm && (
            <div className="hidden lg:block">
              <TopHolders 
                mintAddress={launch.mint_address}
                totalSupply={launch.total_supply}
                poolAddress={launch.dbc_pool_address}
                connection={connection}
              />
            </div>
          )}
        </div>
      </div>

      {/* Comments - Last thing before footer */}
      <div className="mt-8">
        <TokenComments
          mintAddress={launch.mint_address}
          currentWallet={connected ? publicKey?.toString() ?? null : null}
        />
      </div>
    </div>
  );
}
