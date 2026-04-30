import { Connection, Commitment } from '@solana/web3.js';

const ENDPOINT =
  (import.meta as any).env?.VITE_SOLANA_RPC_URL ||
  'https://solana-rpc.publicnode.com';

// Singleton connection — reuse across the app
let _connection: Connection | null = null;

export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  if (!_connection) {
    _connection = new Connection(ENDPOINT, {
      commitment,
      wsEndpoint: ENDPOINT.replace('https', 'wss').replace('http', 'ws'),
      confirmTransactionInitialTimeout: 60000,
      disableRetryOnRateLimit: false,
    });
  }
  return _connection;
}

// Utility: confirm with timeout + retry
export async function confirmTx(
  signature: string,
  connection: Connection,
  maxRetries = 5
): Promise<boolean> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const result = await connection.confirmTransaction(signature, 'confirmed');
      if (result.value.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
      }
      return true;
    } catch {
      retries++;
      await new Promise((r) => setTimeout(r, 2000 * retries));
    }
  }
  throw new Error(`Could not confirm tx after ${maxRetries} retries: ${signature}`);
}
