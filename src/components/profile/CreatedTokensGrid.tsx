import { useEffect, useState } from 'react';
import { TokenCard } from '../tokens/TokenCard';
import { getUserLaunches, Launch } from '../../lib/supabase/queries';
import { Coins } from 'lucide-react';

interface CreatedTokensGridProps {
  wallet: string;
}

export function CreatedTokensGrid({ wallet }: CreatedTokensGridProps) {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getUserLaunches(wallet)
      .then(setLaunches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [wallet]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-52 rounded-xl skeleton" />
        ))}
      </div>
    );
  }

  if (launches.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-3">
          <Coins size={20} className="text-[#333]" />
        </div>
        <p className="text-[#444] font-mono text-sm">No tokens created yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {launches.map((launch) => (
        <TokenCard key={launch.id} launch={launch} />
      ))}
    </div>
  );
}
