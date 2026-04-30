import { createContext, useContext, useState, useEffect } from 'react';

export type ChainType = 'solana' | 'evm';

interface ChainContextType {
  chain: ChainType;
  setChain: (chain: ChainType) => void;
  evmChainKey: string; // e.g. 'ethereum', 'bsc'
  setEvmChainKey: (key: string) => void;
}

const ChainContext = createContext<ChainContextType>({
  chain: 'evm',
  setChain: () => {},
  evmChainKey: 'ethereum',
  setEvmChainKey: () => {},
});

export function useChain() {
  return useContext(ChainContext);
}

export function ChainProvider({ children }: { children: React.ReactNode }) {
    const [chain, setChainState] = useState<ChainType>(() => {
    const stored = localStorage.getItem('tokena_chain');
    return (stored === 'evm' || stored === 'solana') ? stored : 'evm';
  });

  const [evmChainKey, setEvmChainKeyState] = useState<string>(() => {
    return localStorage.getItem('tokena_evm_chain') || 'ethereum';
  });

  function setChain(c: ChainType) {
    setChainState(c);
    localStorage.setItem('tokena_chain', c);
  }

  function setEvmChainKey(key: string) {
    setEvmChainKeyState(key);
    localStorage.setItem('tokena_evm_chain', key);
  }

  return (
    <ChainContext.Provider value={{ chain, setChain, evmChainKey, setEvmChainKey }}>
      {children}
    </ChainContext.Provider>
  );
}
