import { useState } from 'react';
import { Twitter, Send, Globe, ExternalLink, CheckCircle, Edit3, Users, BarChart3, Coins, DollarSign, Calendar, Star } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { FollowButton } from './FollowButton';
import { EditProfileModal } from './EditProfileModal';
import { formatAddress, formatNumber, formatSol, formatTelegramLink, formatWebsiteLink, formatUsdCompact } from '../../lib/utils';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import type { Profile, ProfileStats } from '../../lib/supabase/types';

interface ProfileHeaderProps {
  profile: Profile;
  stats: ProfileStats;
  solPrice: number;
  isOwner?: boolean;
  onProfileUpdated: () => void;
  onShowFollowers?: () => void;
  onShowFollowing?: () => void;
  onShowFavorites?: () => void;
}

function walletGradient(wallet: string): string {
  const hash = wallet.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 60%, 40%))`;
}

export function ProfileHeader({ 
  profile, 
  stats, 
  solPrice,
  isOwner: isOwnerProp, 
  onProfileUpdated,
  onShowFollowers,
  onShowFollowing,
  onShowFavorites
}: ProfileHeaderProps) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [editOpen, setEditOpen] = useState(false);
  
  const isOwner = isOwnerProp !== undefined 
    ? isOwnerProp 
    : publicKey?.toString() === profile.wallet_address;

  const displayName = profile.display_name || formatAddress(profile.wallet_address);
  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <>
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-5">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="profile-avatar flex-shrink-0">
              {profile.avatar_url ? (
                <img
                  src={ipfsToHttp(profile.avatar_url)}
                  alt={displayName}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-[#1a1a1a]"
                />
              ) : (
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-[#1a1a1a] flex items-center justify-center text-2xl font-bold font-display text-white"
                  style={{ background: walletGradient(profile.wallet_address) }}
                >
                  {(profile.display_name || profile.wallet_address).slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name + Actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-display font-bold text-white">{displayName}</h1>
                    {profile.is_verified && (
                      <div className="flex items-center gap-1 text-[#4A9EFF]" title="Verified Creator">
                        <CheckCircle size={16} />
                      </div>
                    )}
                  </div>
                  {profile.username && (
                    <p className="text-sm font-mono text-[#555] mt-0.5">@{profile.username}</p>
                  )}
                  <a
                    href={`https://solscan.io/account/${profile.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-[#444] hover:text-[#888] mt-1 transition-colors"
                  >
                    {formatAddress(profile.wallet_address)} <ExternalLink size={9} />
                  </a>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isOwner ? (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="btn-secondary px-4 py-2 rounded-xl text-sm inline-flex items-center gap-1.5"
                    >
                      <Edit3 size={13} /> Edit Profile
                    </button>
                  ) : publicKey ? (
                    <FollowButton
                      currentWallet={publicKey.toString()}
                      targetWallet={profile.wallet_address}
                    />
                  ) : (
                    <button
                      onClick={() => setVisible(true)}
                      className="btn-primary px-4 py-2 rounded-xl text-sm"
                    >
                      Connect to Follow
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm font-mono text-[#888] mb-3 leading-relaxed max-w-xl">{profile.bio}</p>
          )}

          {/* Social Links */}
          <div className="flex items-center gap-5 mt-4 mb-5 flex-wrap">
            {profile.twitter && (
              <a
                href={`https://twitter.com/${profile.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#555] hover:text-white transition-colors"
                title={`Twitter: ${profile.twitter}`}
              >
                <svg viewBox="0 0 24 24" className="w-[20px] h-[20px] fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            )}
            {profile.telegram && (
              <a
                href={formatTelegramLink(profile.telegram)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#555] hover:text-[#888] transition-colors"
                title="Telegram"
              >
                <Send size={20} />
              </a>
            )}
            {profile.website && (
              <a
                href={formatWebsiteLink(profile.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#555] hover:text-[#888] transition-colors"
                title="Website"
              >
                <Globe size={20} />
              </a>
            )}
            <span className="flex items-center gap-1.5 text-xs font-mono text-[#333]">
              <Calendar size={13} /> Joined {joinDate}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Followers', value: formatNumber(profile.follower_count), icon: Users, onClick: onShowFollowers },
              { label: 'Following', value: formatNumber(profile.following_count), icon: Users, onClick: onShowFollowing },
              { label: 'Starred', value: formatNumber((profile as any).favorites_count || 0), icon: Star, onClick: onShowFavorites },
              { label: 'Tokens Created', value: formatNumber(stats.total_tokens_created), icon: Coins },
              { label: 'Volume', value: `${formatSol(stats.total_volume_sol)} SOL`, icon: BarChart3 },
              { label: 'Creator Earnings', value: `${formatSol(stats.total_creator_earnings)} SOL`, icon: DollarSign },
            ].map(({ label, value, icon: Icon, onClick }) => (
              <div 
                key={label} 
                className={`bg-[#111] border border-[#1a1a1a] rounded-xl p-3 transition-colors ${onClick ? 'cursor-pointer hover:bg-[#161616] hover:border-[#222]' : ''}`}
                onClick={onClick}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className={`${onClick ? 'text-[#F5A623]' : 'text-[#555]'}`} />
                  <span className={`text-xs font-mono text-[#444] ${onClick ? 'underline underline-offset-2 cursor-pointer transition-colors hover:text-[#777]' : ''}`}>{label}</span>
                </div>
                <div className="text-sm font-mono text-white font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={() => {
          setEditOpen(false);
          onProfileUpdated();
        }}
      />
    </>
  );
}
