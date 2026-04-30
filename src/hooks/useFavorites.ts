import { useState, useEffect, useCallback } from 'react';
import { isFavorited as isFavoritedQuery, toggleFavorite as toggleFavoriteQuery } from '../lib/supabase/social-queries';

export function useFavorites(wallet: string | null | undefined, mint: string | null | undefined) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!wallet || !mint) {
      setIsFavorited(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const status = await isFavoritedQuery(wallet, mint);
      setIsFavorited(status);
    } catch (err) {
      console.error('useFavorites fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [wallet, mint]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const toggleFavorite = useCallback(async () => {
    if (!wallet || !mint) return;

    // Optimistic update
    setIsFavorited(prev => !prev);

    try {
      const result = await toggleFavoriteQuery(wallet, mint);
      // Ensure we match the DB result
      setIsFavorited(result);
    } catch (err) {
      // Revert on error
      setIsFavorited(prev => !prev);
      console.error('Toggle favorite error:', err);
    }
  }, [wallet, mint]);

  return {
    isFavorited,
    loading,
    toggleFavorite,
    refetch: fetchStatus,
  };
}
