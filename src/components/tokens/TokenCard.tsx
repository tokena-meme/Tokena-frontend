import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Zap, User, Star } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useFavorites } from '../../hooks/useFavorites';
import { Launch } from '../../lib/supabase/queries';
import { ProgressBar } from '../ui/ProgressBar';
import { Badge } from '../ui/Badge';
import { formatNumber, formatUsd, formatUsdCompact, formatAddress } from '../../lib/utils';
import { getMcapUsd, getMigrationProgress, formatMcapUsd } from '../../lib/utils/marketcap';
import { usePrices } from '../../hooks/usePrices';
import { useOnChainMcap } from '../../hooks/useOnChainMcap';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import { EVM_CHAINS } from '../../lib/evm/constants';
import { ChainIcon } from '../ui/ChainIcons';

interface TokenCardProps {
  launch: Launch;
  commentsCount?: number;
}

export function TokenCard({ launch, commentsCount }: TokenCardProps) {
  const navigate = useNavigate();
  const { solPrice, ethPrice, bnbPrice } = usePrices();
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const { isFavorited, toggleFavorite } = useFavorites(publicKey?.toString(), launch.mint_address);

  const isEvm = launch.chain !== 'solana' && launch.chain != null;
  const nativePriceUsd = isEvm ? (launch.chain === 'bsc' ? bnbPrice : ethPrice) : solPrice;
  const nativeRaised = isEvm ? (launch.eth_raised ?? 0) : launch.sol_raised;

  // Fetch market cap directly from on-chain bonding curve (Solana only)
  const onChainMcap = useOnChainMcap(!isEvm ? launch.dbc_pool_address : null);

  // On-chain value takes priority; fall back to DB-based formula
  const marketCapUsd = isEvm 
    ? (launch.total_supply * (launch.initial_price_sol || 0.0000000008) * nativePriceUsd) 
    : (onChainMcap?.marketCapUsd ?? getMcapUsd(nativeRaised, nativePriceUsd));

  const effectiveRaised = isEvm ? nativeRaised : (onChainMcap?.solRaised ?? nativeRaised);
  const progressPercent = Math.min(100, Math.max(0, (effectiveRaised / (launch.migration_threshold_sol || (isEvm ? 0.5 : 85))) * 100));
  const raisedUsd = nativeRaised * nativePriceUsd;

  const evmTaxSum = isEvm && launch.is_tax_token 
    ? (launch.dev_buy_fee_percent ?? 0) + (launch.marketing_buy_fee_percent ?? 0) 
    : 0;
  const launchTaxPct = isEvm ? evmTaxSum : (launch.creator_fee_percent ?? 0);

  return (
    <div
      className="token-card bg-[#0d0d0d] rounded-xl p-4 cursor-pointer"
      onClick={() => navigate(`/token/${launch.mint_address}`)}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 relative">
          {launch.image_url ? (
            <img
              src={ipfsToHttp(launch.image_url)}
              alt={launch.name}
              className="w-12 h-12 rounded-xl object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F5A623] to-[#FF6B35] flex items-center justify-center text-black font-bold text-lg font-display">
              {launch.symbol.slice(0, 2)}
            </div>
          )}
          {launch.is_migrated && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00D4AA] rounded-full flex items-center justify-center">
              <Zap size={8} className="text-black" />
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!connected) {
                setVisible(true);
              } else {
                toggleFavorite();
              }
            }}
            className={`absolute -bottom-1 -right-1 p-1 rounded-md transition-all z-10 ${
              isFavorited
                ? 'bg-[#F5A623] text-black border border-[#F5A623]'
                : 'bg-[#111]/80 text-[#555] hover:text-white border border-[#1a1a1a]'
            }`}
          >
            <Star size={10} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white font-ui truncate">{launch.name}</h3>
            <span className="text-xs font-mono text-[#555]">${launch.symbol}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Chain badge */}
            {(!launch.chain || launch.chain === 'solana') ? (
              <Badge variant="default"><span className="flex items-center gap-1"><ChainIcon chainKey="solana" size={10} /> SOL</span></Badge>
            ) : (
              <Badge variant={launch.chain === 'bsc' ? 'amber' : 'blue'}>
                <span className="flex items-center gap-1"><ChainIcon chainKey={launch.chain} size={10} /> {EVM_CHAINS[launch.chain]?.shortName ?? launch.chain.toUpperCase()}</span>
              </Badge>
            )}
            {launch.is_featured && <Badge variant="amber">Featured</Badge>}
            {launch.is_migrated ? (
              <Badge variant="green">Migrated</Badge>
            ) : (
              <Badge variant="default">Active</Badge>
            )}
            {launchTaxPct > 0 && (
              <Badge variant={launchTaxPct > 3 ? 'red' : 'blue'}>
                Tax: {launchTaxPct}%
              </Badge>
            )}
          </div>
        </div>
      </div>

      {launch.description && (
        <p className="text-xs text-[#555] font-mono line-clamp-2 mb-3">{launch.description}</p>
      )}

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-[#555]">Migration Progress</span>
          <span className={launch.is_migrated ? 'text-[#00D4AA]' : 'text-[#F5A623]'}>
            {progressPercent.toFixed(1)}%
          </span>
        </div>
        <ProgressBar value={progressPercent} migrated={launch.is_migrated} />
      </div>

      <div className="grid grid-cols-4 gap-y-3 gap-x-3 pt-3 border-t border-[#111]">
        <div>
          <div className="text-xs text-[#444] font-mono mb-0.5">MC</div>
          <div className="flex items-center gap-1">
            <TrendingUp size={10} className="text-[#F5A623]" />
            <span className="text-sm font-mono text-white">{formatMcapUsd(marketCapUsd)}</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-[#444] font-mono mb-0.5">Volume</div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-mono text-[#888]">
              {formatUsdCompact((launch.volume_sol ?? 0) * nativePriceUsd)}
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-[#444] font-mono mb-0.5">Tax</div>
          <div className="flex items-center gap-1">
            <span className={`text-sm font-mono font-medium ${launchTaxPct > 3 ? 'text-[#FF4444]' : launchTaxPct > 0 ? 'text-[#4A9EFF]' : 'text-[#555]'}`}>
              {launchTaxPct}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-[#444] font-mono mb-0.5">Creator</div>
          <div className="flex items-center gap-1 overflow-hidden">
            <Link
              to={`/profile/${launch.creator_wallet}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-mono text-[#F5A623] underline underline-offset-2 truncate transition-colors hover:text-[#FF6B35]"
            >
              {launch.creator_profile?.display_name || launch.creator_profile?.username || formatAddress(launch.creator_wallet)}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
