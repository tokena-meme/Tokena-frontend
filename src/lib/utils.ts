export function formatSol(val: number, decimals = 2): string {
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  if (val >= 1) return val.toFixed(decimals);
  if (val >= 0.01) return val.toFixed(4);
  return val.toFixed(6);
}

export function formatNumber(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString();
}

export function formatPrice(val: number): string {
  if (val >= 1) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  return `$${val.toExponential(3)}`;
}

export function formatUsd(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  return `$${val.toExponential(3)}`;
}

export function formatUsdCompact(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export function formatAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function generateMockMint(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  return Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function generateMockTx(): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: 88 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function calcMigrationProgress(solRaised: number, threshold: number): number {
  return Math.min((solRaised / threshold) * 100, 100);
}

export function formatTelegramLink(url: string | null | undefined): string {
  if (!url) return '';
  let cleaned = url.trim();
  
  // If it's a full URL that's NOT t.me, respect it as an external link
  if ((cleaned.startsWith('http://') || cleaned.startsWith('https://')) && !cleaned.includes('t.me')) {
    return cleaned;
  }
  
  // For t.me links or raw handles, strip everything and rebuild
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/^t\.me\//, '');
  cleaned = cleaned.replace(/^@/, '');
  
  // Fallback to a clear telegram link
  return `https://t.me/${cleaned}`;
}

export function formatWebsiteLink(url: string | null | undefined): string {
  if (!url) return '';
  let cleaned = url.trim();
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) return cleaned;
  return `https://${cleaned}`;
}
