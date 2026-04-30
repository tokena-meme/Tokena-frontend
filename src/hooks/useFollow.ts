import { useEffect, useState, useCallback } from 'react';
import { isFollowing as checkIsFollowing, followUser, unfollowUser } from '../lib/supabase/social-queries';

export function useFollow(currentWallet: string | null | undefined, targetWallet: string | null | undefined) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!currentWallet || !targetWallet || currentWallet === targetWallet) {
      setChecking(false);
      return;
    }
    setChecking(true);
    checkIsFollowing(currentWallet, targetWallet)
      .then(setFollowing)
      .catch(() => setFollowing(false))
      .finally(() => setChecking(false));
  }, [currentWallet, targetWallet]);

  const follow = useCallback(async () => {
    if (!currentWallet || !targetWallet || loading) return;
    setLoading(true);
    setFollowing(true); // Optimistic
    try {
      await followUser(currentWallet, targetWallet);
    } catch (err) {
      setFollowing(false); // Revert on error
      console.error('Follow error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWallet, targetWallet, loading]);

  const unfollow = useCallback(async () => {
    if (!currentWallet || !targetWallet || loading) return;
    setLoading(true);
    setFollowing(false); // Optimistic
    try {
      await unfollowUser(currentWallet, targetWallet);
    } catch (err) {
      setFollowing(true); // Revert on error
      console.error('Unfollow error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentWallet, targetWallet, loading]);

  return { isFollowing: following, follow, unfollow, loading, checking };
}
