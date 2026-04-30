import { useEffect, useState, useCallback } from 'react';
import { getProfile, subscribeToProfileUpdates } from '../lib/supabase/social-queries';
import type { Profile } from '../lib/supabase/types';

export function useProfile(wallet: string | null | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!wallet) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const p = await getProfile(wallet);
      setProfile(p);
    } catch (err) {
      console.error('useProfile error:', err);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime updates
  useEffect(() => {
    if (!wallet) return;
    const sub = subscribeToProfileUpdates(wallet, (updated) => {
      setProfile(updated);
    });
    return () => { sub.unsubscribe(); };
  }, [wallet]);

  return { profile, loading, refetch: fetchProfile };
}
