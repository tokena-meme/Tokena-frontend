import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, Package, History, ArrowUpRight, ArrowDownRight, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getUserTrades, getUserLaunches, getCreatorEarnedFees, subscribeToUserTrades, getZeroFeeLaunches, getAllEvmLaunches, Launch } from '../lib/supabase/queries';
import { TokenCard } from '../components/tokens/TokenCard';
import { Badge } from '../components/ui/Badge';
import { formatSol, formatNumber, timeAgo, formatAddress } from '../lib/utils';
import { ipfsToHttp } from '../lib/ipfs/pinata';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { useClaimFees } from '../hooks/useClaimFees';
import { useEvmClaimFees } from '../hooks/useEvmClaimFees';
import { useEvmWallet } from '../hooks/useEvmWallet';
import { usePrices } from '../hooks/usePrices';
import { getCachedSolPrice } from '../lib/utils/marketcap';
import { PLATFORM_FEE_WALLET } from '../lib/meteora/constants';

export function Portfolio() {
  const navigate = useNavigate();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { solBalance } = useWalletBalance();
  const walletAddress = publicKey?.toString() ?? '';
  const isPlatformWallet = walletAddress === PLATFORM_FEE_WALLET;

  const evmWallet = useEvmWallet();
  const { solPrice: liveSolPrice, ethPrice } = usePrices();

  const [trades, setTrades] = useState<Awaited<ReturnType<typeof getUserTrades>>>([]);
  const [myLaunches, setMyLaunches] = useState<Launch[]>([]);
  const [allEvmLaunches, setAllEvmLaunches] = useState<Launch[]>([]);
  const [platformLaunches, setPlatformLaunches] = useState<Launch[]>([]);
  const [earnedFees, setEarnedFees] = useState<number>(0);
  const [tab, setTab] = useState<'trades' | 'launches' | 'fees'>('trades');
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState(0);

  // ─── Creator fee claiming ───
  const creatorPoolAddresses = myLaunches.filter(l => l.dbc_pool_address).map(l => l.dbc_pool_address as string);
  const creatorFeeMap: Record<string, number> = {};
  const creatorPoolCreatorMap: Record<string, string> = {};
  myLaunches.forEach((l) => {
    if (l.dbc_pool_address) {
      creatorFeeMap[l.dbc_pool_address] = l.creator_fee_percent ?? 0;
      creatorPoolCreatorMap[l.dbc_pool_address] = l.creator_wallet;
    }
  });

  const {
    claim: creatorClaim,
    claimableMap: creatorClaimableMap,
    totalClaimable: creatorTotalClaimable,
    totalClaimed: creatorTotalClaimed,
    totalClaimedMap: creatorTotalClaimedMap,
    sessionClaimed: creatorSessionClaimed,
    claimingPool: creatorClaimingPool,
    loadingPools: creatorLoadingPools,
  } = useClaimFees(creatorPoolAddresses, creatorFeeMap, creatorPoolCreatorMap);

  // ─── EVM fee claiming (checks ALL EVM launches for this wallet) ───
  const {
    claim: evmClaim,
    claimableMap: evmClaimableMap,
    totalClaimable: evmTotalClaimable,
    totalClaimed: evmTotalClaimed,
    totalClaimedMap: evmTotalClaimedMap,
    claimingPool: evmClaimingPool,
    loadingPools: evmLoadingPools,
  } = useEvmClaimFees(evmWallet.connected ? allEvmLaunches : [], evmWallet.address);

  // Merge for display
  const totalClaimable = creatorTotalClaimable + evmTotalClaimable;
  const totalClaimed = creatorTotalClaimed + evmTotalClaimed;
  const sessionClaimed = creatorSessionClaimed;
  const loadingPools = creatorLoadingPools || evmLoadingPools;

  useEffect(() => {
    getCachedSolPrice().then(setSolPrice);
    // Fetch ALL EVM launches for fee checking
    getAllEvmLaunches().then(setAllEvmLaunches).catch(console.error);
  }, []);

  useEffect(() => {
    if (!connected || !walletAddress) return;
    setLoading(true);

    const fetches: Promise<any>[] = [
      getUserTrades(walletAddress),
      getUserLaunches(walletAddress),
      getCreatorEarnedFees(walletAddress),
    ];

    // Platform wallet: fetch ALL tokens to show in portfolio or analytics if needed, or remove.
    // For now we don't strictly need getZeroFeeLaunches for claiming, since creators claim.

    Promise.all(fetches)
      .then(([t, l, f, pLaunches]) => {
        setTrades(t);
        setMyLaunches(l);
        setEarnedFees(f);
        if (pLaunches) setPlatformLaunches(pLaunches);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const sub = subscribeToUserTrades(walletAddress, (newTrade) => {
      setTrades((prev) => {
        if (prev.some(t => t.id === newTrade.id)) return prev;
        return [newTrade as any, ...prev];
      });
    });

    return () => {
      sub.unsubscribe();
    };
  }, [connected, walletAddress]);

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-md mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-5">
            <Wallet size={28} className="text-[#444]" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Connect your wallet</h2>
          <p className="text-[#555] font-mono text-sm mb-6">Connect your Solana wallet to view your portfolio, trade history, and launches.</p>
          <button
            onClick={() => setVisible(true)}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm inline-block"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const totalBought = trades.filter((t) => t.type === 'buy').reduce((sum, t) => sum + Number(t.sol_amount), 0);
  const totalSold = trades.filter((t) => t.type === 'sell').reduce((sum, t) => sum + Number(t.sol_amount), 0);

  // Determine which launches to show in the fees tab
  const feeLaunches: { launch: Launch; claimable: number; totalClaimedSol: number; isClaiming: boolean; onClaim: () => Promise<any>; isPlatform: boolean }[] = [];

  // Add creator's own Solana launches (including 0% ones because they now get 0.3%)
  myLaunches.filter(l => l.dbc_pool_address && (!l.chain || l.chain === 'solana')).forEach((launch) => {
    feeLaunches.push({
      launch,
      claimable: creatorClaimableMap[launch.dbc_pool_address!] ?? 0,
      totalClaimedSol: creatorTotalClaimedMap[launch.dbc_pool_address!] ?? 0,
      isClaiming: creatorClaimingPool === launch.dbc_pool_address,
      onClaim: () => creatorClaim(launch.dbc_pool_address!),
      isPlatform: false,
    });
  });

  // Add EVM launches where this wallet has on-chain fees (any role: creator, dev, marketing)
  allEvmLaunches.filter(l => l.mint_address && ((evmClaimableMap[l.mint_address] ?? 0) > 0 || (evmTotalClaimedMap[l.mint_address] ?? 0) > 0)).forEach((launch) => {
    feeLaunches.push({
      launch,
      claimable: evmClaimableMap[launch.mint_address] ?? 0,
      totalClaimedSol: evmTotalClaimedMap[launch.mint_address] ?? 0,
      isClaiming: evmClaimingPool === launch.mint_address,
      onClaim: () => evmClaim(launch),
      isPlatform: false,
    });
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-white mb-1">Portfolio</h1>
        <p className="text-xs font-mono text-[#444]">
          {formatAddress(walletAddress)} · {solBalance.toFixed(4)} SOL
          {isPlatformWallet && <span className="ml-2 text-[#F5A623]">· Platform Wallet</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Trades', value: trades.length.toString(), icon: History },
          { label: 'Total Bought', value: `${formatSol(totalBought)} SOL`, icon: ArrowUpRight },
          { label: 'Total Sold', value: `${formatSol(totalSold)} SOL`, icon: ArrowDownRight },
          { label: 'My Launches', value: myLaunches.length.toString(), icon: Package },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} className="text-[#555]" />
              <span className="text-xs font-mono text-[#444]">{label}</span>
            </div>
            <div className="text-xl font-display font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 mb-6 border-b border-[#111]">
        {[{ id: 'trades', label: 'Trade History' }, { id: 'launches', label: 'My Launches' }, { id: 'fees', label: 'Claim Fees' }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'trades' | 'launches' | 'fees')}
            className={`px-4 py-2.5 text-sm font-medium font-ui transition-all border-b-2 -mb-px ${
              tab === t.id ? 'border-[#F5A623] text-white' : 'border-transparent text-[#555] hover:text-[#888]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}
        </div>
      ) : tab === 'trades' ? (
        trades.length === 0 ? (
          <div className="text-center py-16 text-[#444] font-mono text-sm">No trades yet. Start trading to see history here.</div>
        ) : (
          <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
            <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-[#111] text-xs font-mono text-[#444] uppercase tracking-wider">
              <span className="col-span-2">Token</span>
              <span>Type</span>
              <span>SOL</span>
              <span>Tokens</span>
              <span className="text-right">Time</span>
            </div>
            {trades.map((trade) => (
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
                <span className="text-sm font-mono text-white">{formatSol(Number(trade.sol_amount))}</span>
                <span className="text-sm font-mono text-[#888]">{formatNumber(Number(trade.token_amount))}</span>
                <span className="text-right text-xs font-mono text-[#444]">{timeAgo(trade.created_at)}</span>
              </div>
            ))}
          </div>
        )
      ) : tab === 'fees' ? (
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

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                <div className="text-xs font-mono text-[#555] mb-1 uppercase tracking-wider">Claimable</div>
                <div className="text-sm font-mono text-[#00D4AA] font-bold">{formatSol(totalClaimable)} SOL</div>
                <div className="text-xs font-mono text-[#555]">${formatNumber(totalClaimable * solPrice)}</div>
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                <div className="text-xs font-mono text-[#555] mb-1 uppercase tracking-wider">Total Claimed</div>
                <div className="text-sm font-mono text-[#4A9EFF] font-bold">{formatSol(totalClaimed)} SOL</div>
                <div className="text-xs font-mono text-[#555]">${formatNumber(totalClaimed * solPrice)}</div>
              </div>
              <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3">
                <div className="text-xs font-mono text-[#555] mb-1 uppercase tracking-wider">Session</div>
                <div className="text-sm font-mono text-white font-bold">{formatSol(sessionClaimed)} SOL</div>
              </div>
            </div>

            <p className="text-xs font-mono text-[#888] leading-relaxed mb-4">
              Your tax fees accumulate securely on-chain in the Tokena bonding curve contracts. 
              Even for standard tokens, you earn a revenue share from trading volume automatically. 
              Click <span className="text-[#4A9EFF]">Claim</span> to withdraw them to your wallet.
            </p>
          </div>

          {feeLaunches.length === 0 ? (
            <div className="text-center py-12 text-[#444] font-mono text-sm">
              You haven't launched any tokens yet. Launch a token to start earning fees.
            </div>
          ) : loadingPools ? (
            <div className="text-center py-12 text-[#444] font-mono text-sm flex justify-center items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading pool fees...
            </div>
          ) : (
            feeLaunches.map((item) => (
              <ClaimFeeRow
                key={`${item.launch.id}-${item.isPlatform ? 'platform' : 'creator'}`}
                launch={item.launch}
                claimableSol={item.claimable}
                totalClaimedSol={item.totalClaimedSol}
                solPrice={solPrice}
                isClaiming={item.isClaiming}
                onClaim={item.onClaim}
                isPlatform={item.isPlatform}
              />
            ))
          )}
        </div>
      ) : (
        myLaunches.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#444] font-mono text-sm mb-4">You haven&apos;t launched any tokens yet.</p>
            <Link to="/launch/create" className="btn-primary px-6 py-2.5 rounded-xl text-sm inline-block">
              Launch your first token
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myLaunches.map((launch) => (
              <TokenCard key={launch.id} launch={launch} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Claim Fee Row ────────────────────────────────────────────────

function ClaimFeeRow({ launch, claimableSol, totalClaimedSol, solPrice, isClaiming, onClaim, isPlatform }: {
  launch: Launch;
  claimableSol: number;
  totalClaimedSol: number;
  solPrice: number;
  isClaiming: boolean;
  onClaim: () => Promise<any>;
  isPlatform?: boolean;
}) {
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const isEvm = launch.chain !== 'solana' && launch.chain != null;
  const evmTaxSum = isEvm && launch.is_tax_token 
    ? (launch.dev_buy_fee_percent ?? 0) + (launch.marketing_buy_fee_percent ?? 0) 
    : 0;
  const taxPct = isEvm ? evmTaxSum : (launch.creator_fee_percent ?? 0);
  const canClaim = claimableSol > 0;

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
        <div className="flex-shrink-0">
          {launch.image_url ? (
            <img src={ipfsToHttp(launch.image_url)} alt={launch.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black text-xs font-bold font-display">
              {launch.symbol.slice(0, 2)}
            </div>
          )}
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
            <span>Claimable: <span className={claimableSol > 0 ? "text-[#00D4AA]" : "text-[#555]"}>{formatSol(claimableSol)} SOL</span></span>
            <span>Claimed: <span className="text-[#4A9EFF]">{formatSol(totalClaimedSol)} SOL</span></span>
          </div>
        </div>
        <div className="flex-shrink-0">
          {claimed && claimableSol === 0 ? (
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
