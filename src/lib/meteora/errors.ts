// Common Solana errors and what to show users
const SOLANA_ERRORS: Record<string, string> = {
  '0x1': 'Insufficient SOL balance',
  '0x1770': 'Slippage exceeded — price moved. Try increasing slippage.',
  'Transaction was not confirmed': 'Network congestion. Please retry.',
  'User rejected': 'Transaction cancelled.',
  'insufficient funds': 'Not enough SOL to cover this trade + fees.',
  'TokenAccountNotFoundError': "You don't have a token account for this mint yet.",
  'blockhash not found': 'Transaction expired. Please retry.',
  'Simulation failed': 'Transaction simulation failed. Check your balance.',
};

export function parseTradeError(err: unknown): string {
  const msg = (err as any)?.message ?? String(err);
  
  if (msg.includes('row-level security policy')) {
    return 'Database permission error. Please run the RLS SQL fix in Supabase.';
  }
  
  if (msg.includes('Transaction failed on-chain')) {
    return `On-chain error: ${msg}`;
  }
  
  if (msg.includes('Simulation failed') && (err as any)?.logs) {
    const logs = ((err as any).logs as string[]).join('\n');
    return `Simulation failed! Program Logs:\n${logs}`;
  }
  
  for (const [key, human] of Object.entries(SOLANA_ERRORS)) {
    if (msg.includes(key)) return human;
  }
  
  return `Transaction failed. Error: ${msg.slice(0, 100)}`;
}
