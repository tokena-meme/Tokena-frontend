import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import { upsertUser } from '@/lib/supabase/queries';
import { useChain } from '@/providers/ChainProvider';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { ChainIcon } from '../ui/ChainIcons';

export function ConnectButton() {
  const { chain } = useChain();

  if (chain === 'evm') {
    return <EvmConnectButton />;
  }
  return <SolanaConnectButton />;
}

// ─── Solana ────────────────────────────────────────────────
function SolanaConnectButton() {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      upsertUser(publicKey.toString()).catch(console.error);
      fetchBalance();
    }
  }, [connected, publicKey]);

  async function fetchBalance() {
    if (!publicKey) return;
    try {
      const { getConnection } = await import('@/lib/solana/connection');
      const conn = getConnection();
      const bal = await conn.getBalance(publicKey);
      setBalance(bal / 1e9);
    } catch (e) {
      console.error('Balance fetch failed:', e);
    }
  }

  function copyAddress() {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function truncate(addr: string) {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  }

  if (connecting) {
    return (
      <button
        disabled
        className="px-4 py-1.5 rounded-lg text-xs font-mono border border-[#F5A623]/20 bg-[#F5A623]/10 text-[#F5A623] cursor-not-allowed tracking-wider"
      >
        Connecting...
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <div className="relative inline-block">
        <div className="flex items-center bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
          {balance !== null && (
            <div className="px-3 py-1.5 text-xs font-mono text-[#888] border-r border-[#1a1a1a]">
              {balance.toFixed(3)} SOL
            </div>
          )}
          <button
            onClick={copyAddress}
            className="px-3 py-1.5 text-xs font-mono text-[#F5A623] bg-transparent border-none cursor-pointer hover:text-white transition-colors"
          >
            {copied ? 'Copied!' : truncate(publicKey.toString())}
          </button>
          <button
            onClick={() => disconnect()}
            className="px-2.5 py-1.5 text-xs text-[#444] bg-transparent border-none border-l border-[#1a1a1a] cursor-pointer hover:text-white transition-colors"
            style={{ borderLeft: '1px solid #1a1a1a' }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      className="btn-primary px-4 py-1.5 text-sm rounded-lg flex items-center gap-2"
    >
      Connect Wallet
    </button>
  );
}

// ─── EVM (MetaMask) ────────────────────────────────────────
function EvmConnectButton() {
  const { address, balance, connected, connecting, connect, disconnect, targetChain } = useEvmWallet();
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function truncate(addr: string) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  if (connecting) {
    return (
      <button
        disabled
        className="px-4 py-1.5 rounded-lg text-xs font-mono border border-[#627EEA]/20 bg-[#627EEA]/10 text-[#627EEA] cursor-not-allowed tracking-wider"
      >
        Connecting...
      </button>
    );
  }

  if (connected && address) {
    return (
      <div className="relative inline-block">
        <div className="flex items-center bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
          {balance && (
            <div className="px-3 py-1.5 text-xs font-mono text-[#888] border-r border-[#1a1a1a]">
              {parseFloat(balance).toFixed(4)} {targetChain?.nativeCurrency.symbol ?? 'ETH'}
            </div>
          )}
          <button
            onClick={copyAddress}
            className="px-3 py-1.5 text-xs font-mono text-[#627EEA] bg-transparent border-none cursor-pointer hover:text-white transition-colors"
          >
            {copied ? 'Copied!' : truncate(address)}
          </button>
          <button
            onClick={disconnect}
            className="px-2.5 py-1.5 text-xs text-[#444] bg-transparent border-none border-l border-[#1a1a1a] cursor-pointer hover:text-white transition-colors"
            style={{ borderLeft: '1px solid #1a1a1a' }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-1.5 text-sm rounded-lg flex items-center gap-2 bg-[#627EEA] text-white font-semibold hover:bg-[#627EEA]/80 transition-colors"
    >
      <ChainIcon chainKey={targetChain?.chainId === 56 ? 'bsc' : 'ethereum'} size={16} />
      Connect Wallet
    </button>
  );
}
