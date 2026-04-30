import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, ShoppingCart, ArrowDownLeft, MessageCircle, UserPlus, Activity, Heart } from 'lucide-react';
import { getUserActivity } from '../../lib/supabase/social-queries';
import { formatSol, formatAddress, timeAgo } from '../../lib/utils';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import type { ActivityItem, ActivityType } from '../../lib/supabase/types';

interface ActivityFeedProps {
  wallet: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: typeof Rocket; color: string; verb: string }> = {
  created_token: { icon: Rocket, color: '#F5A623', verb: 'created' },
  bought_token: { icon: ShoppingCart, color: '#00D4AA', verb: 'bought' },
  sold_token: { icon: ArrowDownLeft, color: '#FF4444', verb: 'sold' },
  commented: { icon: MessageCircle, color: '#4A9EFF', verb: 'commented on' },
  followed: { icon: UserPlus, color: '#A855F7', verb: 'followed' },
  favorited_token: { icon: Heart, color: '#F43F5E', verb: 'favorited' },
};

export function ActivityFeed({ wallet }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserActivity(wallet, 50)
      .then(setActivities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <Activity size={20} className="text-[#333]" />
        </div>
        <p className="text-[#444] font-mono text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((item) => {
        const config = ACTIVITY_CONFIG[item.type];
        const Icon = config.icon;

        return (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#0d0d0d] transition-colors animate-fade-in">
            {/* Icon */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${config.color}15`, border: `1px solid ${config.color}25` }}
            >
              <Icon size={14} style={{ color: config.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap text-sm">
                <Link
                  to={`/profile/${item.wallet}`}
                  className="font-semibold text-white font-ui hover:text-[#F5A623] transition-colors"
                >
                  {formatAddress(item.wallet)}
                </Link>
                <span className="font-mono text-[#555]">{config.verb}</span>

                {/* Token link */}
                {item.metadata.token_name && item.metadata.token_mint && (
                  <Link
                    to={`/token/${item.metadata.token_mint}`}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                  >
                    {item.metadata.token_image && (
                      <img
                        src={ipfsToHttp(item.metadata.token_image)}
                        alt=""
                        className="w-4 h-4 rounded object-cover"
                      />
                    )}
                    <span className="font-semibold text-white font-ui">{item.metadata.token_name}</span>
                    <span className="text-[#555] font-mono text-xs">${item.metadata.token_symbol}</span>
                  </Link>
                )}

                {/* Trade amount */}
                {(item.metadata.sol_amount !== undefined || item.metadata.eth_amount !== undefined) && (
                  <span className="font-mono text-[#888]">
                    {item.metadata.chain && item.metadata.chain !== 'solana'
                      ? `${(item.metadata.eth_amount ?? 0).toFixed(6)} ${item.metadata.chain === 'bsc' ? 'BNB' : 'ETH'}`
                      : `${formatSol(item.metadata.sol_amount ?? 0)} SOL`}
                  </span>
                )}

                {/* Followed wallet */}
                {item.type === 'followed' && item.metadata.followed_wallet && (
                  <Link
                    to={`/profile/${item.metadata.followed_wallet}`}
                    className="font-semibold text-white font-ui hover:text-[#F5A623] transition-colors"
                  >
                    {formatAddress(item.metadata.followed_wallet)}
                  </Link>
                )}
              </div>

              {/* Comment text preview */}
              {item.type === 'commented' && item.metadata.comment_text && (
                <p className="text-xs font-mono text-[#555] mt-0.5 truncate max-w-md">
                  "{item.metadata.comment_text}"
                </p>
              )}

              <span className="text-xs font-mono text-[#333] mt-0.5 block">{timeAgo(item.timestamp)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
