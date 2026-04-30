import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useState, useCallback } from 'react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';

export function useWalletBalance() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [solBalance, setSolBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connected) return;
    setIsLoading(true);
    try {
      const lamports = await connection.getBalance(publicKey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connected, connection]);

  useEffect(() => {
    fetchBalance();
    // Subscribe to account changes
    if (!publicKey) return;
    const id = connection.onAccountChange(publicKey, (info) => {
      setSolBalance(info.lamports / LAMPORTS_PER_SOL);
    });
    return () => {
      connection.removeAccountChangeListener(id);
    };
  }, [publicKey, connected, fetchBalance, connection]);

  return { solBalance, isLoading, refetch: fetchBalance };
}

export function useTokenBalance(mintAddress: string | null) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  useEffect(() => {
    if (!publicKey || !mintAddress) return;

    async function fetchTokenBal() {
      try {
        const mint = new PublicKey(mintAddress!);
        const ata = await getAssociatedTokenAddress(mint, publicKey!);
        const account = await getAccount(connection, ata);
        setTokenBalance(Number(account.amount) / 1e6); // TOKEN_DECIMALS = 6
      } catch (err) {
        if (err instanceof TokenAccountNotFoundError) {
          setTokenBalance(0);
        }
      }
    }

    fetchTokenBal();
  }, [publicKey, mintAddress, connection]);

  return tokenBalance;
}
