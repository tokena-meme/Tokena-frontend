import { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, JsonRpcSigner, formatEther } from 'ethers';
import { EVM_CHAINS } from '@/lib/evm/constants';
import { useChain } from '@/providers/ChainProvider';

interface EvmWalletState {
  address: string | null;
  balance: string | null; // formatted native currency
  connected: boolean;
  chainId: number | null;
  connecting: boolean;
  error: string | null;
}

export function useEvmWallet() {
  const { evmChainKey } = useChain();
  const targetChain = EVM_CHAINS[evmChainKey];
  
  const [state, setState] = useState<EvmWalletState>({
    address: null,
    balance: null,
    connected: false,
    chainId: null,
    connecting: false,
    error: null,
  });

  const getProvider = useCallback(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return null;
    return new BrowserProvider((window as any).ethereum);
  }, []);

  const fetchBalance = useCallback(async (provider: BrowserProvider, addr: string) => {
    try {
      const bal = await provider.getBalance(addr);
      return formatEther(bal);
    } catch {
      return null;
    }
  }, []);

  // Check existing connection on mount
  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    async function checkConnection() {
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const provider = new BrowserProvider(ethereum);
          const network = await provider.getNetwork();
          const bal = await fetchBalance(provider, accounts[0]);
          setState({
            address: accounts[0],
            balance: bal,
            connected: true,
            chainId: Number(network.chainId),
            connecting: false,
            error: null,
          });
        }
      } catch (err) {
        console.error('EVM wallet check failed:', err);
      }
    }

    checkConnection();

    // Listen for account/chain changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState({ address: null, balance: null, connected: false, chainId: null, connecting: false, error: null });
      } else {
        setState((prev) => ({ ...prev, address: accounts[0], connected: true }));
      }
    };

    const handleChainChanged = () => {
      // Refresh on chain change
      checkConnection();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [fetchBalance]);

  // Refresh balance when address or evmChainKey changes
  useEffect(() => {
    if (!state.address) return;
    const provider = getProvider();
    if (!provider) return;
    fetchBalance(provider, state.address).then((bal) => {
      setState((prev) => ({ ...prev, balance: bal }));
    });
  }, [state.address, evmChainKey, getProvider, fetchBalance]);

  const connect = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setState((prev) => ({ ...prev, error: 'MetaMask not installed' }));
      return;
    }

    setState((prev) => ({ ...prev, connecting: true, error: null }));

    try {
      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

      // Switch to target chain
      if (targetChain) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + targetChain.chainId.toString(16) }],
          });
        } catch (switchErr: any) {
          // Chain not added — try adding it
          if (switchErr.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + targetChain.chainId.toString(16),
                chainName: targetChain.name,
                rpcUrls: [targetChain.rpcUrl],
                blockExplorerUrls: [targetChain.explorerUrl],
                nativeCurrency: targetChain.nativeCurrency,
              }],
            });
          }
        }
      }

      const provider = new BrowserProvider(ethereum);
      const network = await provider.getNetwork();
      const bal = await fetchBalance(provider, accounts[0]);

      setState({
        address: accounts[0],
        balance: bal,
        connected: true,
        chainId: Number(network.chainId),
        connecting: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: err?.message ?? 'Connection failed',
      }));
    }
  }, [targetChain, fetchBalance]);

  const disconnect = useCallback(() => {
    setState({ address: null, balance: null, connected: false, chainId: null, connecting: false, error: null });
  }, []);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner | null> => {
    const provider = getProvider();
    if (!provider) return null;
    return provider.getSigner();
  }, [getProvider]);

  return {
    ...state,
    connect,
    disconnect,
    getSigner,
    getProvider,
    targetChain,
  };
}
