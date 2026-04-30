import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, MessageCircle } from 'lucide-react';
import { CommentInput } from './CommentInput';
import { useComments } from '../../hooks/useComments';
import { formatAddress, timeAgo } from '../../lib/utils';
import { ipfsToHttp } from '../../lib/ipfs/pinata';
import type { TokenComment } from '../../lib/supabase/types';

interface TokenCommentsProps {
  mintAddress: string;
  currentWallet: string | null;
}

export function TokenComments({ mintAddress, currentWallet }: TokenCommentsProps) {
  const {
    comments,
    loading,
    submitting,
    addComment,
    deleteComment,
    toggleLike,
    likedIds,
  } = useComments(mintAddress, currentWallet);

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#111] flex items-center gap-2">
        <MessageCircle size={14} className="text-[#4A9EFF]" />
        <span className="text-sm font-semibold text-white font-ui">Comments</span>
        {comments.length > 0 && (
          <span className="text-xs font-mono text-[#555] bg-[#111] px-1.5 py-0.5 rounded-md">
            {comments.length}
          </span>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pt-3 pb-2">
        <CommentInput
          onSubmit={addComment}
          isSubmitting={submitting}
          isConnected={!!currentWallet}
        />
      </div>

      {/* Comments List */}
      <div className="px-4 pb-3">
        {loading ? (
          <div className="space-y-3 mt-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg skeleton flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 skeleton rounded" />
                  <div className="h-4 w-full skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm font-mono text-[#333]">No comments yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            {comments.filter(c => !c.parent_id).map((comment) => (
              <div key={comment.id}>
                <CommentRow
                  comment={comment}
                  currentWallet={currentWallet}
                  isLiked={likedIds.has(comment.id)}
                  onLike={() => toggleLike(comment.id)}
                  onDelete={() => deleteComment(comment.id)}
                  onReply={(text) => addComment(text, comment.id)}
                  isSubmittingReply={submitting}
                />
                
                {/* Render Replies */}
                <div className="ml-8 border-l border-[#1a1a1a] pl-2 space-y-1">
                  {comments
                    .filter(c => c.parent_id === comment.id)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) // Replies chronological
                    .map(reply => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        currentWallet={currentWallet}
                        isLiked={likedIds.has(reply.id)}
                        onLike={() => toggleLike(reply.id)}
                        onDelete={() => deleteComment(reply.id)}
                        isReply
                      />
                    ))
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Comment Row ────────────────────────────────────────

function CommentRow({
  comment,
  currentWallet,
  isLiked,
  onLike,
  onDelete,
  onReply,
  isSubmittingReply,
  isReply = false
}: {
  comment: TokenComment;
  currentWallet: string | null;
  isLiked: boolean;
  onLike: () => void;
  onDelete: () => void;
  onReply?: (text: string) => Promise<void>;
  isSubmittingReply?: boolean;
  isReply?: boolean;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const isOwner = currentWallet === comment.wallet;
  const displayName = comment.profile?.display_name || comment.profile?.username || formatAddress(comment.wallet);

  return (
    <div className={`space-y-2 ${isReply ? 'opacity-90 scale-[0.98] origin-left' : ''}`}>
      <div className="flex gap-3 p-2.5 rounded-xl hover:bg-[#111]/50 transition-colors comment-slide-in group">
        {/* Avatar */}
        <Link to={`/profile/${comment.wallet}`} className="flex-shrink-0">
          {comment.profile?.avatar_url ? (
            <img
              src={ipfsToHttp(comment.profile.avatar_url)}
              alt=""
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white font-display ${isReply ? 'scale-90' : ''}`}
                 style={{ background: `linear-gradient(135deg, ${isReply ? '#333' : '#F5A623'}, ${isReply ? '#222' : '#FF6B35'})` }}>
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              to={`/profile/${comment.wallet}`}
              className="text-xs font-semibold text-white font-ui hover:text-[#F5A623] transition-colors"
            >
              {displayName}
            </Link>
            {comment.profile?.is_verified && (
              <span className="text-[#4A9EFF] text-xs">✓</span>
            )}
            <span className="text-xs font-mono text-[#333]">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm font-mono text-[#888] leading-relaxed break-words">{comment.text}</p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            <button
              onClick={onLike}
              disabled={!currentWallet}
              className={`flex items-center gap-1 text-xs font-mono transition-all ${
                isLiked
                  ? 'text-[#FF4444]'
                  : 'text-[#333] hover:text-[#FF4444]'
              } ${!currentWallet ? 'cursor-default opacity-50' : ''}`}
            >
              <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
              {comment.likes_count > 0 && comment.likes_count}
            </button>

            {!isReply && onReply && currentWallet && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className={`flex items-center gap-1 text-xs font-mono transition-colors ${isReplying ? 'text-[#F5A623]' : 'text-[#333] hover:text-[#F5A623]'}`}
              >
                <MessageCircle size={11} />
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            )}

            {isOwner && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-xs font-mono text-[#333] hover:text-[#FF4444] transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Reply Input */}
      {isReplying && onReply && (
        <div className="ml-8 pb-2 animate-in slide-in-from-top-1 duration-200">
          <CommentInput
            placeholder={`Reply to ${displayName}...`}
            onSubmit={async (text) => {
              await onReply(text);
              setIsReplying(false);
            }}
            isSubmitting={!!isSubmittingReply}
            isConnected={true}
          />
        </div>
      )}
    </div>
  );
}
