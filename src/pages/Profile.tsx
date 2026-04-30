import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, AlertCircle, Loader2, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileTabs, ProfileTab } from '../components/profile/ProfileTabs';
import { CreatedTokensGrid } from '../components/profile/CreatedTokensGrid';
import { HoldingsGrid } from '../components/profile/HoldingsGrid';
import { ActivityFeed } from '../components/profile/ActivityFeed';
import { TokenCard } from '../components/tokens/TokenCard';
import { Badge } from '../components/ui/Badge';
import { useProfile } from '../hooks/useProfile';
import { getProfileStats, getUserComments, getUserFavorites, getFollowersWithProfiles, getFollowingWithProfiles } from '../lib/supabase/social-queries';
import { getUserLaunches, getUserTrades, getCreatorEarnedFees, getLaunchesByMints, getAllEvmLaunches, subscribeToUserTrades, Launch, Trade } from '../lib/supabase/queries';
import { UserListModal } from '../components/profile/UserListModal';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useClaimFees } from '../hooks/useClaimFees';
import { useEvmClaimFees } from '../hooks/useEvmClaimFees';
import { useEvmWallet } from '../hooks/useEvmWallet';
import { useChain } from '../providers/ChainProvider';
import { usePrices } from '../hooks/usePrices';
import { getCachedSolPrice } from '../lib/utils/marketcap';
import { formatAddress, formatSol, formatNumber, timeAgo } from '../lib/utils';
import { ipfsToHttp } from '../lib/ipfs/pinata';
import { PLATFORM_FEE_WALLET } from '../lib/meteora/constants';
import type { ProfileStats, TokenComment } from '../lib/supabase/types';

export function Profile() {
  const { wallet: walletParam } = useParams<{ wallet: string }>();
  const navigate = useNavigate();
  const { publicKey, connected } = useWallet();
  const evmWallet = useEvmWallet();
  const { setVisible } = useWalletModal();
  const { solPrice, ethPrice } = usePrices();
  const { solBalance } = useWalletBalance();

  const { chain } = useChain();

  // Deduce the active ecosystem view from the URL param, or fallback to the top toggle state
  const activeViewChain = walletParam 
    ? (walletParam.startsWith('0x') ? 'evm' : 'solana') 
    : chain;

  // Determine the correct wallet address to query
  let wallet = walletParam;
  if (!wallet) {
    if (activeViewChain === 'solana') {
      wallet = publicKey?.toString();
    } else {
      wallet = evmWallet.address || undefined;
    }
  }
  
  // Determine if the connected user owns this specific ecosystem profile
  let isOwner = false;
  if (activeViewChain === 'solana') {
    isOwner = !!(connected && publicKey?.toString() === wallet);
  } else {
    isOwner = !!(evmWallet.connected && evmWallet.address?.toLowerCase() === wallet?.toLowerCase());
  }

  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile(wallet);

  const [tab, setTab] = useState<ProfileTab>('created');
  const [stats, setStats] = useState<ProfileStats>({ total_tokens_created: 0, total_volume_sol: 0, total_creator_earnings: 0 });
  const [launchCount, setLaunchCount] = useState(0);
  const [userComments, setUserComments] = useState<TokenComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [favoriteLaunches, setFavoriteLaunches] = useState<Launch[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  // ─── Modal state (Followers/Following) ───
  const [userListModal, setUserListModal] = useState<{
    open: boolean;
    title: string;
    users: any[];
    loading: boolean;
  }>({ open: false, title: '', users: [], loading: false });

  const handleShowFollowers = async () => {
    if (!wallet) return;
    setUserListModal({ open: true, title: 'Followers', users: [], loading: true });
    try {
      const users = await getFollowersWithProfiles(wallet);
      setUserListModal(prev => ({ ...prev, users, loading: false }));
    } catch (err) {
      console.error('Failed to fetch followers:', err);
      setUserListModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleShowFollowing = async () => {
    if (!wallet) return;
    setUserListModal({ open: true, title: 'Following', users: [], loading: true });
    try {
      const users = await getFollowingWithProfiles(wallet);
      setUserListModal(prev => ({ ...prev, users, loading: false }));
    } catch (err) {
      console.error('Failed to fetch following:', err);
      setUserListModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ─── Portfolio state (only for own profile) ───
  const [trades, setTrades] = useState<Awaited<ReturnType<typeof getUserTrades>>>([]);
  const [myLaunches, setMyLaunches] = useState<Launch[]>([]);
  const [allEvmLaunches, setAllEvmLaunches] = useState<Launch[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [cachedSolPrice, setCachedSolPrice] = useState(0);

  // ─── Creator fee claiming ───
  const activeLaunches = activeViewChain === 'solana' 
    ? myLaunches.filter(l => !l.chain || l.chain === 'solana')
    : myLaunches.filter(l => l.chain && l.chain !== 'solana');

  const solLaunches = activeViewChain === 'solana' ? activeLaunches : [];

  // --- Solana Fees ---
  const solCreatorPoolAddresses = solLaunches.filter(l => l.dbc_pool_address).map(l => l.dbc_pool_address as string);
  const solCreatorFeeMap: Record<string, number> = {};
  const solCreatorPoolCreatorMap: Record<string, string> = {};
  solLaunches.forEach((l) => {
    if (l.dbc_pool_address) {
      solCreatorFeeMap[l.dbc_pool_address] = l.creator_fee_percent ?? 0;
      solCreatorPoolCreatorMap[l.dbc_pool_address] = l.creator_wallet;
    }
  });

  const {
    claim: solClaim,
    claimableMap: solClaimableMap,
    totalClaimable: solTotalClaimable,
    totalClaimed: solTotalClaimed,
    totalClaimedMap: solTotalClaimedMap,
    sessionClaimed: solSessionClaimed,
    claimingPool: solClaimingPool,
    loadingPools: solLoadingPools,
  } = useClaimFees(isOwner ? solCreatorPoolAddresses : [], solCreatorFeeMap, solCreatorPoolCreatorMap);

  // --- EVM Fees (check ALL EVM launches for pending fees, not just user-created ones) ---
  const {
    claim: evmClaim,
    claimableMap: evmClaimableMap,
    totalClaimable: evmTotalClaimable,
    totalClaimed: evmTotalClaimed,
    totalClaimedMap: evmTotalClaimedMap,
    sessionClaimed: evmSessionClaimed,
    claimingPool: evmClaimingPool,
    loadingPools: evmLoadingPools,
  } = useEvmClaimFees(isOwner && activeViewChain === 'evm' ? allEvmLaunches : [], wallet);

  // Fetch stats + all EVM launches for fee checking
  useEffect(() => {
    if (!wallet) return;
    getProfileStats(wallet).then(setStats).catch(console.error);
    getUserLaunches(wallet).then(l => {
      setLaunchCount(l.length);
      setMyLaunches(l);
    }).catch(console.error);
    // Fetch ALL EVM launches so the fee hook can check pendingFees for this wallet on every contract
    getAllEvmLaunches().then(setAllEvmLaunches).catch(console.error);
  }, [wallet]);

  // Fetch portfolio data (own profile only)
  useEffect(() => {
    if (!isOwner || !wallet) return;
    setTradesLoading(true);
    getCachedSolPrice().then(setCachedSolPrice);

    getUserTrades(wallet)
      .then(setTrades)
      .catch(console.error)
      .finally(() => setTradesLoading(false));

    const sub = subscribeToUserTrades(wallet, (newTrade) => {
      setTrades((prev) => {
        if (prev.some(t => t.id === newTrade.id)) return prev;
        return [newTrade as any, ...prev];
      });
    });

    return () => { sub.unsubscribe(); };
  }, [isOwner, wallet]);

  // Fetch user comments when tab is active
  useEffect(() => {
    if (tab !== 'comments' || !wallet) return;
    setCommentsLoading(true);
    getUserComments(wallet, 50)
      .then(setUserComments)
      .catch(console.error)
      .finally(() => setCommentsLoading(false));
  }, [tab, wallet]);

  // Fetch favorites when tab is active
  useEffect(() => {
    if (tab !== 'favorites' || !wallet) return;
    setFavoritesLoading(true);
    getUserFavorites(wallet)
      .then(mints => getLaunchesByMints(mints))
      .then(setFavoriteLaunches)
      .catch(console.error)
      .finally(() => setFavoritesLoading(false));
  }, [tab, wallet]);

  // Initial fetch for favorite count
  const [favoritesCount, setFavoritesCount] = useState(0);
  useEffect(() => {
    if (!wallet) return;
    getUserFavorites(wallet).then(mints => setFavoritesCount(mints.length));
  }, [wallet]);

  // Not connected and no wallet param → show connect prompt
  if (!wallet) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-5">
            <Wallet size={28} className="text-[#444]" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Connect your wallet</h2>
          <p className="text-[#555] font-mono text-sm mb-6">
            Connect your {activeViewChain === 'solana' ? 'Solana' : 'EVM'} wallet to view your profile, trade history, and launches.
          </p>
          {activeViewChain === 'solana' ? (
            <button
              onClick={() => setVisible(true)}
              className="btn-primary px-6 py-2.5 rounded-xl text-sm inline-block"
            >
              Connect Solana Wallet
            </button>
          ) : (
            <button
              onClick={() => evmWallet.connect()}
              className="px-6 py-2.5 rounded-xl text-sm inline-block bg-[#4A9EFF] text-black font-semibold"
            >
              Connect MetaMask
            </button>
          )}
        </div>
      </div>
    );
  }

  if (profileLoading || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="h-48 rounded-2xl skeleton" />
        <div className="h-10 rounded-xl skeleton" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const activeTrades = activeViewChain === 'solana'
    ? trades.filter(t => !t.chain || t.chain === 'solana')
    : trades.filter(t => t.chain && t.chain !== 'solana');

  const feesSolPrice = cachedSolPrice || solPrice;

  const feeItems = activeViewChain === 'solana' ? solLaunches.filter(l => l.dbc_pool_address).map((launch) => ({
    launch,
    claimable: solClaimableMap[launch.dbc_pool_address!] ?? 0,
    totalClaimed: solTotalClaimedMap[launch.dbc_pool_address!] ?? 0,
    isClaiming: solClaimingPool === launch.dbc_pool_address,
    onClaim: () => solClaim(launch.dbc_pool_address!),
    currency: 'SOL',
    nativePriceUsd: feesSolPrice,
  })) : allEvmLaunches.filter(l => l.mint_address && ((evmClaimableMap[l.mint_address] ?? 0) > 0 || (evmTotalClaimedMap[l.mint_address] ?? 0) > 0)).map((launch) => ({
    launch,
    claimable: evmClaimableMap[launch.mint_address] ?? 0,
    totalClaimed: evmTotalClaimedMap[launch.mint_address] ?? 0,
    isClaiming: evmClaimingPool === launch.mint_address,
    onClaim: () => evmClaim(launch),
    currency: 'ETH',
    nativePriceUsd: ethPrice,
  }));

  feeItems.sort((a,b) => b.claimable - a.claimable);
  
  const totalClaimableNative = activeViewChain === 'solana' ? solTotalClaimable : evmTotalClaimable;
  const totalClaimedNative = activeViewChain === 'solana' ? solTotalClaimed : evmTotalClaimed;
  const nativePriceUsd = activeViewChain === 'solana' ? feesSolPrice : ethPrice;
  const currencyStr = activeViewChain === 'solana' ? 'SOL' : 'ETH';

  const handleShowFavorites = () => {
    setTab('favorites');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {walletParam && (
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-mono text-[#444] hover:text-white transition-colors mb-5">
          <ArrowLeft size={12} /> Back
        </Link>
      )}

      <div className="space-y-5">
        <ProfileHeader
          profile={{ ...profile, favorites_count: favoritesCount } as any}
          stats={stats}
          solPrice={solPrice}
          isOwner={isOwner}
          onProfileUpdated={refetchProfile}
          onShowFollowers={handleShowFollowers}
          onShowFollowing={handleShowFollowing}
          onShowFavorites={handleShowFavorites}
        />

        <ProfileTabs
          activeTab={tab}
          onTabChange={setTab}
          isOwner={isOwner}
          counts={{
            created: activeLaunches.length,
            trades: isOwner ? activeTrades.length : undefined,
            comments: activeViewChain === 'solana' ? userComments.length || undefined : undefined,
            favorites: activeViewChain === 'solana' ? favoritesCount || undefined : undefined,
          }}
        />

        <div className="min-h-[300px]">
          {/* Created Tokens */}
          {tab === 'created' && <CreatedTokensGrid wallet={wallet} />}

          {/* Holdings */}
          {tab === 'holdings' && <HoldingsGrid wallet={wallet} />}

          {/* Activity */}
          {tab === 'activity' && <ActivityFeed wallet={wallet} />}

          {/* Favorites */}
          {tab === 'favorites' && (
            favoritesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-52 rounded-xl skeleton" />)}
              </div>
            ) : favoriteLaunches.length === 0 ? (
              <div className="text-center py-16 text-[#444] font-mono text-sm">No favorited tokens yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteLaunches.map((launch) => (
                  <TokenCard key={launch.id} launch={launch} />
                ))}
              </div>
            )
          )}

          {tab === 'trades' && isOwner && (
            tradesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}
              </div>
            ) : activeTrades.length === 0 ? (
              <div className="text-center py-16 text-[#444] font-mono text-sm">No trades yet. Start trading on {activeViewChain === 'solana' ? 'Solana' : 'EVM'} to see history here.</div>
            ) : (
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
                <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-[#111] text-xs font-mono text-[#444] uppercase tracking-wider">
                  <span className="col-span-2">Token</span>
                  <span>Type</span>
                  <span>{currencyStr}</span>
                  <span>Tokens</span>
                  <span className="text-right">Time</span>
                </div>
                {activeTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="grid grid-cols-6 gap-3 px-5 py-3.5 border-b border-[#0f0f0f] hover:bg-[#0f0f0f] cursor-pointer transition-colors items-center"
                    onClick={() => trade.launch && navigate(`/token/${trade.launch.mint_address}`)}
                  >
                    <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                      {trade.launch?.image_url ? (
                        <img src={ipfsToHttp(trade.launch.image_url)} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-[#111] flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm text-white font-ui truncate">{trade.launch?.name ?? 'Unknown'}</div>
                        <div className="text-xs text-[#555] font-mono">${trade.launch?.symbol}</div>
                      </div>
                    </div>
                    <div>
                      {trade.type === 'buy' ? (
                        <Badge variant="green">BUY</Badge>
                      ) : (
                        <Badge variant="red">SELL</Badge>
                      )}
                    </div>
                    <span className="text-sm font-mono text-white">{formatSol(Number(activeViewChain === 'evm' ? trade.eth_amount : trade.sol_amount))}</span>
                    <span className="text-sm font-mono text-[#888]">{formatNumber(Number(trade.token_amount))}</span>
                    <span className="text-right text-xs font-mono text-[#444]">{timeAgo(trade.created_at)}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Claim Fees (owner only) */}
          {tab === 'fees' && isOwner && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4A9EFF]/20 to-[#4A9EFF]/5 border border-[#4A9EFF]/20 flex items-center justify-center">
                    <Download size={18} className="text-[#4A9EFF]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-display font-bold text-white">Claim Trading Fees</h2>
                    <p className="text-xs font-mono text-[#555]">
                      Claim accumulated tax from your launched tokens
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-xs font-mono text-[#555] mb-1 uppercase tracking-wider">Claimable</div>
                    <div className="text-sm font-mono text-[#00D4AA] font-bold">{formatSol(totalClaimableNative)} {currencyStr}</div>
                    <div className="text-xs font-mono text-[#555]">${formatNumber(totalClaimableNative * nativePriceUsd)}</div>
                  </div>
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                    <div className="text-xs font-mono text-[#555] mb-1 uppercase tracking-wider">Total Claimed</div>
                    <div className="text-sm font-mono text-[#4A9EFF] font-bold">{formatSol(totalClaimedNative)} {currencyStr}</div>
                    <div className="text-xs font-mono text-[#555]">${formatNumber(totalClaimedNative * nativePriceUsd)}</div>
                  </div>
                </div>

                <p className="text-xs font-mono text-[#888] leading-relaxed mb-4">
                  Your tax fees accumulate securely on-chain in the Tokena bonding curve contracts. 
                  Even for standard tokens, you earn a revenue share from trading volume automatically. 
                  Click <span className="text-[#4A9EFF]">Claim</span> to withdraw them to your wallet.
                </p>
              </div>

              {feeItems.length === 0 ? (
                <div className="text-center py-12 text-[#444] font-mono text-sm">
                  You haven't launched any tokens yet. Launch a token to start earning fees.
                </div>
              ) : (solLoadingPools || evmLoadingPools) && Object.keys(solClaimableMap).length === 0 && Object.keys(evmClaimableMap).length === 0 ? (
                <div className="text-center py-12 text-[#444] font-mono text-sm flex justify-center items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading pool fees...
                </div>
              ) : (
                feeItems.map((item) => (
                  <ClaimFeeRow
                    key={item.launch.id}
                    launch={item.launch}
                    claimableAmount={item.claimable}
                    totalClaimedAmount={item.totalClaimed}
                    nativePriceUsd={item.nativePriceUsd}
                    currency={item.currency}
                    isClaiming={item.isClaiming}
                    onClaim={item.onClaim}
                  />
                ))
              )}
            </div>
          )}

          {/* Comments */}
          {tab === 'comments' && (
            commentsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl skeleton" />
                ))}
              </div>
            ) : userComments.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#444] font-mono text-sm">No comments yet.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {userComments.map((comment) => (
                  <Link
                    key={comment.id}
                    to={`/token/${comment.token_mint}`}
                    className="block p-3 rounded-xl hover:bg-[#0d0d0d] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[#555]">
                        on {formatAddress(comment.token_mint)}
                      </span>
                      <span className="text-xs font-mono text-[#333]">{timeAgo(comment.created_at)}</span>
                    </div>
                    <p className="text-sm font-mono text-[#888]">"{comment.text}"</p>
                    <div className="text-xs font-mono text-[#333] mt-1">
                      ❤ {comment.likes_count}
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <UserListModal 
        isOpen={userListModal.open}
        onClose={() => setUserListModal(prev => ({ ...prev, open: false }))}
        title={userListModal.title}
        users={userListModal.users}
        loading={userListModal.loading}
      />
    </div>
  );
}

// ─── Claim Fee Row ────────────────────────────────────────────────

function ClaimFeeRow({ launch, claimableAmount, totalClaimedAmount, nativePriceUsd, currency, isClaiming, onClaim }: {
  launch: Launch;
  claimableAmount: number;
  totalClaimedAmount: number;
  nativePriceUsd: number;
  currency: string;
  isClaiming: boolean;
  onClaim: () => Promise<any>;
}) {
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const isEvm = launch.chain !== 'solana' && launch.chain != null;
  const evmTaxSum = isEvm && launch.is_tax_token 
    ? (launch.dev_buy_fee_percent ?? 0) + (launch.marketing_buy_fee_percent ?? 0) 
    : 0;
  const taxPct = isEvm ? evmTaxSum : (launch.creator_fee_percent ?? 0);
  const canClaim = claimableAmount > 0;

  async function handleClaim() {
    setClaimError(null);
    try {
      const result = await onClaim();
      if (result) setClaimed(true);
    } catch (err: any) {
      setClaimError(err?.message ?? 'Failed to claim');
    }
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 relative">
          {launch.image_url ? (
            <img src={ipfsToHttp(launch.image_url)} alt={launch.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black text-xs font-bold font-display">
              {launch.symbol.slice(0, 2)}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1">
             <Badge variant={currency === 'SOL' ? 'amber' : 'blue'}>{currency}</Badge>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white font-ui truncate">{launch.name}</span>
            <span className="text-xs font-mono text-[#555]">${launch.symbol}</span>
            {taxPct > 0 ? (
              <Badge variant={taxPct > 3 ? 'red' : 'blue'}>Tax: {taxPct}%</Badge>
            ) : (
              <Badge variant="blue">Standard (Revenue Share)</Badge>
            )}
          </div>
          <div className="text-xs font-mono text-[#444] mt-0.5 flex gap-3">
            <span>Claimable: <span className={claimableAmount > 0 ? "text-[#00D4AA]" : "text-[#555]"}>{formatSol(claimableAmount)} {currency} (${formatNumber(claimableAmount * nativePriceUsd)})</span></span>
            <span>Claimed: <span className="text-[#4A9EFF]">{formatSol(totalClaimedAmount)} {currency}</span></span>
          </div>
        </div>
        <div className="flex-shrink-0">
          {claimed && claimableAmount === 0 ? (
            <div className="flex items-center gap-1.5 text-[#00D4AA] text-xs font-mono">
              <CheckCircle size={14} />
              Claimed
            </div>
          ) : (
            <button
              onClick={handleClaim}
              disabled={isClaiming || !canClaim}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-all
                ${isClaiming
                  ? 'bg-[#111] text-[#555] cursor-wait'
                  : !canClaim
                    ? 'bg-[#111] text-[#333] cursor-not-allowed'
                    : 'bg-[#4A9EFF]/10 text-[#4A9EFF] border border-[#4A9EFF]/20 hover:bg-[#4A9EFF]/20'
                }`}
            >
              {isClaiming ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Claiming...
                </span>
              ) : !canClaim ? (
                'Nothing to claim'
              ) : (
                'Claim Fees'
              )}
            </button>
          )}
        </div>
      </div>
      {claimError && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-[#FF4444]">
          <AlertCircle size={11} />
          {claimError}
        </div>
      )}
    </div>
  );
}
