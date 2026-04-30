import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getCommentsByMint,
  addComment as addCommentQuery,
  deleteComment as deleteCommentQuery,
  likeComment as likeCommentQuery,
  unlikeComment as unlikeCommentQuery,
  getCommentLikesByUser,
  subscribeToComments,
  subscribeToCommentDeletes,
} from '../lib/supabase/social-queries';
import type { TokenComment } from '../lib/supabase/types';

export function useComments(mint: string | null | undefined, currentWallet: string | null | undefined) {
  const [comments, setComments] = useState<TokenComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const lastCommentTime = useRef(0);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!mint) return;
    setLoading(true);
    try {
      const data = await getCommentsByMint(mint, 100);
      setComments(data);

      // Check which comments the current user has liked
      if (currentWallet && data.length > 0) {
        const ids = data.map(c => c.id);
        const liked = await getCommentLikesByUser(ids, currentWallet);
        setLikedIds(liked);
      }
    } catch (err) {
      console.error('useComments fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [mint, currentWallet]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscriptions
  useEffect(() => {
    if (!mint) return;

    const insertSub = subscribeToComments(mint, (newComment) => {
      setComments(prev => {
        if (prev.some(c => c.id === newComment.id)) return prev;
        return [newComment, ...prev];
      });
    });

    const deleteSub = subscribeToCommentDeletes(mint, (deletedId) => {
      setComments(prev => prev.filter(c => c.id !== deletedId));
    });

    return () => {
      insertSub.unsubscribe();
      deleteSub.unsubscribe();
    };
  }, [mint]);

  // Add comment with rate limiting
  const addComment = useCallback(async (text: string, parentId?: string | null) => {
    if (!mint || !currentWallet || submitting) return;

    // Rate limit: 5 seconds between comments
    const now = Date.now();
    if (now - lastCommentTime.current < 5000) {
      throw new Error('Please wait a few seconds before commenting again');
    }

    setSubmitting(true);
    try {
      const comment = await addCommentQuery(mint, currentWallet, text, parentId);
      lastCommentTime.current = Date.now();
      // The realtime subscription will add it, but also add optimistically
      setComments(prev => {
        if (prev.some(c => c.id === comment.id)) return prev;
        return [comment, ...prev];
      });
    } finally {
      setSubmitting(false);
    }
  }, [mint, currentWallet, submitting]);

  // Delete comment
  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentWallet) return;
    try {
      await deleteCommentQuery(commentId, currentWallet);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  }, [currentWallet]);

  // Like/unlike
  const toggleLike = useCallback(async (commentId: string) => {
    if (!currentWallet) return;

    const isLiked = likedIds.has(commentId);

    // Optimistic update
    setLikedIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });

    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, likes_count: c.likes_count + (isLiked ? -1 : 1) }
        : c
    ));

    try {
      if (isLiked) {
        await unlikeCommentQuery(commentId, currentWallet);
      } else {
        await likeCommentQuery(commentId, currentWallet);
      }
    } catch (err) {
      // Revert optimistic update
      setLikedIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(commentId);
        else next.delete(commentId);
        return next;
      });
      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, likes_count: c.likes_count + (isLiked ? 1 : -1) }
          : c
      ));
    }
  }, [currentWallet, likedIds]);

  return {
    comments,
    loading,
    submitting,
    addComment,
    deleteComment,
    toggleLike,
    likedIds,
    refetch: fetchComments,
  };
}
