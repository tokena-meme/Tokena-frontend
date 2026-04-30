import { useState } from 'react';
import { UserPlus, UserCheck, UserMinus } from 'lucide-react';
import { useFollow } from '../../hooks/useFollow';

interface FollowButtonProps {
  currentWallet: string;
  targetWallet: string;
  className?: string;
}

export function FollowButton({ currentWallet, targetWallet, className = '' }: FollowButtonProps) {
  const { isFollowing, follow, unfollow, loading, checking } = useFollow(currentWallet, targetWallet);
  const [hovered, setHovered] = useState(false);

  if (currentWallet === targetWallet) return null;

  if (checking) {
    return (
      <div className={`px-5 py-2 rounded-xl text-sm font-ui bg-[#111] text-[#333] ${className}`}>
        <div className="w-16 h-4 skeleton rounded" />
      </div>
    );
  }

  if (isFollowing) {
    return (
      <button
        onClick={unfollow}
        disabled={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`follow-btn px-5 py-2 rounded-xl text-sm font-semibold font-ui transition-all duration-200 inline-flex items-center gap-1.5 ${
          hovered
            ? 'bg-[#FF4444]/10 text-[#FF4444] border border-[#FF4444]/30'
            : 'bg-[#111] text-[#888] border border-[#1a1a1a]'
        } ${loading ? 'opacity-50 cursor-wait' : ''} ${className}`}
      >
        {hovered ? (
          <>
            <UserMinus size={14} /> Unfollow
          </>
        ) : (
          <>
            <UserCheck size={14} /> Following
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={follow}
      disabled={loading}
      className={`follow-btn btn-primary px-5 py-2 rounded-xl text-sm font-semibold font-ui inline-flex items-center gap-1.5 ${
        loading ? 'opacity-50 cursor-wait' : ''
      } ${className}`}
    >
      <UserPlus size={14} /> Follow
    </button>
  );
}
