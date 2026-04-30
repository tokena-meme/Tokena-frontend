import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { launchToken, LaunchTokenParams, LaunchTokenResult } from '@/lib/meteora/pool';

export function useLaunchToken() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchTokenResult | null>(null);

  async function launch(params: Omit<LaunchTokenParams, 'wallet' | 'connection'>) {
    if (!wallet.connected) throw new Error('Wallet not connected');
    setIsLoading(true);
    setError(null);

    try {
      const res = await launchToken({ ...params, wallet, connection });
      setResult(res);
      return res;
    } catch (err: any) {
      const msg = err?.message ?? 'Launch failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  return { launch, isLoading, error, result };
}
