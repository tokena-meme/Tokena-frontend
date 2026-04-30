import { Rocket, ExternalLink } from 'lucide-react';

interface MigrationBannerProps {
  meteoraPoolAddress: string;
  symbol: string;
}

export function MigrationBanner({ meteoraPoolAddress, symbol }: MigrationBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/5 p-4">
      <div className="absolute inset-0 bg-gradient-to-r from-[#00D4AA]/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#00D4AA]/10 flex items-center justify-center">
          <Rocket size={18} className="text-[#00D4AA]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#00D4AA] font-ui">{symbol} has graduated!</p>
          <p className="text-xs text-[#00D4AA]/60 font-mono mt-0.5">Bonding curve complete. Trade directly below via Jupiter.</p>
        </div>
        <a
          href={`https://app.meteora.ag/pools/${meteoraPoolAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[#00D4AA]/60 text-xs font-mono rounded-lg border border-[#00D4AA]/20 hover:border-[#00D4AA]/40 hover:text-[#00D4AA] transition-all"
        >
          View Pool <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
