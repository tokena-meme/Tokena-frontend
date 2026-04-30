import { X, User, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { FollowButton } from './FollowButton';
import { formatAddress } from '../../lib/utils';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import type { Profile } from '../../lib/supabase/types';

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  users: Profile[];
  loading: boolean;
}

function walletGradient(wallet: string): string {
  const hash = wallet.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hash * 7) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 60%, 40%))`;
}

export function UserListModal({ isOpen, onClose, title, users, loading }: UserListModalProps) {
  const { publicKey } = useWallet();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#111]">
          <h2 className="text-lg font-display font-bold text-white">{title}</h2>
          <button 
            onClick={onClose}
            className="p-1 text-[#444] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-[#111]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-[#111] rounded w-1/3" />
                    <div className="h-2 bg-[#111] rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center mx-auto mb-3">
                <User size={20} className="text-[#333]" />
              </div>
              <p className="text-sm font-mono text-[#444]">No one here yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => {
                const isSelf = publicKey?.toString() === user.wallet_address;
                const displayName = user.display_name || formatAddress(user.wallet_address);
                
                return (
                  <div 
                    key={user.wallet_address}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#0d0d0d] transition-colors group"
                  >
                    <Link 
                      to={`/profile/${user.wallet_address}`}
                      onClick={onClose}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      {user.avatar_url ? (
                        <img 
                          src={ipfsToHttp(user.avatar_url)} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover border border-[#1a1a1a]"
                        />
                      ) : (
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-[#1a1a1a]"
                          style={{ background: walletGradient(user.wallet_address) }}
                        >
                          {displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-white truncate">{displayName}</span>
                          {user.is_verified && <CheckCircle size={12} className="text-[#4A9EFF]" />}
                        </div>
                        <div className="text-[11px] font-mono text-[#555] truncate">
                          {user.username ? `@${user.username}` : formatAddress(user.wallet_address)}
                        </div>
                      </div>
                    </Link>

                    {publicKey && !isSelf && (
                      <div className="ml-2">
                        <FollowButton 
                          currentWallet={publicKey.toString()}
                          targetWallet={user.wallet_address}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
