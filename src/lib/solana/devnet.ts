/**
 * Devnet helpers for testing.
 * Set VITE_SOLANA_RPC_URL=https://api.devnet.solana.com in .env
 */
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export async function airdropSol(
  wallet: PublicKey,
  connection: Connection,
  amount = 2
) {
  const sig = await connection.requestAirdrop(wallet, amount * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig);
  console.log(`Airdropped ${amount} SOL to ${wallet.toString()}`);
}
