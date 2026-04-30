import { useState, useRef, useEffect } from 'react';
import { useChain } from '../../providers/ChainProvider';
import { VISIBLE_EVM_CHAINS } from '../../lib/evm/constants';
import { ChainIcon } from './ChainIcons';
import { ChevronDown } from 'lucide-react';

interface ChainSelectorProps {
  compact?: boolean;
}

export function ChainSelector({ compact }: ChainSelectorProps) {
  const { chain, setChain, evmChainKey, setEvmChainKey } = useChain();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allChains = [
    { id: 'solana', type: 'solana' as const, name: 'Solana', shortName: 'SOL' },
    ...VISIBLE_EVM_CHAINS.map(c => ({
      id: c.key, type: 'evm' as const, name: c.name, shortName: c.shortName
    }))
  ];

  const currentChain = chain === 'solana' 
    ? allChains[0] 
    : allChains.find(c => c.id === evmChainKey) || allChains[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#1a1a1a] rounded-xl text-sm font-mono text-white hover:bg-[#1a1a1a] transition-all"
      >
        <ChainIcon chainKey={currentChain.id} size={16} />
        {!compact && <span>{currentChain.name}</span>}
        <ChevronDown size={14} className={`text-[#555] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-48 right-0 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl shadow-xl overflow-hidden z-50">
          {allChains.map((c) => {
            const isSelected = currentChain.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  if (c.type === 'solana') {
                    setChain('solana');
                  } else {
                    setChain('evm');
                    setEvmChainKey(c.id);
                  }
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-mono text-left transition-colors hover:bg-[#1a1a1a] group ${
                  isSelected ? 'bg-[#1a1a1a] text-white' : 'text-[#888]'
                }`}
              >
                <div className={`flex items-center justify-center transition-all ${!isSelected ? 'opacity-70 group-hover:opacity-100 grayscale group-hover:grayscale-0' : ''}`}>
                  <ChainIcon chainKey={c.id} size={18} />
                </div>
                <span>{c.name}</span>
                {isSelected && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D4AA]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
