// Official chain logo SVGs

export function SolanaIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 397 312" className={className} xmlns="http://www.w3.org/2000/svg">
      <linearGradient id="sol-grad" x1="360.879" y1="351.455" x2="141.213" y2="-69.294" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 -30)">
        <stop offset="0" stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="url(#sol-grad)" />
      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="url(#sol-grad)" />
      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="url(#sol-grad)" />
    </svg>
  );
}

export function BscIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 126.6 126.6" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M38.73 53.72L63.3 29.16l24.58 24.58 14.3-14.3L63.3.56l-38.87 38.87 14.3 14.3zM.55 63.3l14.3-14.3 14.3 14.3-14.3 14.3L.55 63.3zm38.18 9.58L63.3 97.46l24.58-24.58 14.31 14.29-.01.01L63.3 126.06 24.43 87.19l-.01-.01 14.31-14.3zM97.45 63.3l14.3-14.3 14.3 14.3-14.3 14.3-14.3-14.3z" fill="#F0B90B" />
      <path d="M77.84 63.29h.01L63.3 48.73 52.93 59.1l-.01.01-1.18 1.18-2.48 2.48-.01.01.01.02L63.3 76.86l14.55-14.55.01-.02h-.02z" fill="#F0B90B" />
    </svg>
  );
}

export function EthereumIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 417" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M127.962 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#343434" />
      <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fill="#8C8C8C" />
      <path d="M127.962 312.187l-1.575 1.92V414.05l1.575 4.6L256 236.587z" fill="#3C3C3B" />
      <path d="M127.962 418.65v-106.463L0 236.587z" fill="#8C8C8C" />
      <path d="M127.962 287.958l127.963-75.637-127.963-58.162z" fill="#141414" />
      <path d="M0 212.32l127.962 75.639V154.159z" fill="#393939" />
    </svg>
  );
}

export function BaseIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 111 111" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M54.921 110.034c30.386 0 55.013-24.627 55.013-55.013 0-30.387-24.627-55.014-55.013-55.014C26.004.007 2.394 22.46.078 51.023h73.461v7.997H.08c2.32 28.56 25.928 51.014 54.841 51.014z" fill="#0052FF" />
    </svg>
  );
}

export function ArbitrumIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="256" height="256" rx="48" fill="#213147" />
      <path d="M150.037 130.999L170.249 170.741L191.432 128.379L150.037 130.999Z" fill="#12AAFF" />
      <path d="M128 38.379L89.618 128L128 170.741L166.382 128L128 38.379Z" fill="white" />
      <path d="M89.618 128L64.568 170.741L128 217.621L191.432 128.379L166.382 128L128 170.741L89.618 128Z" fill="#9DCCED" />
      <path d="M128 217.621L64.568 170.741L85.751 130.999L128 217.621Z" fill="#213147" />
    </svg>
  );
}

// Get the right icon component for a chain key
export function ChainIcon({ chainKey, size = 16, className = '' }: { chainKey: string; size?: number; className?: string }) {
  switch (chainKey) {
    case 'solana':
      return <SolanaIcon size={size} className={className} />;
    case 'bsc':
      return <BscIcon size={size} className={className} />;
    case 'ethereum':
    case 'sepolia':
      return <EthereumIcon size={size} className={className} />;
    case 'base':
      return <BaseIcon size={size} className={className} />;
    case 'arbitrum':
      return <ArbitrumIcon size={size} className={className} />;
    default:
      return <EthereumIcon size={size} className={className} />;
  }
}
