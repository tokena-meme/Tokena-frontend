import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Trade } from '../supabase/queries';

/**
 * Fetches recent trades for a given pool directly from the Solana blockchain.
 * This parses transaction history for swap instructions.
 */
export async function getOnChainTrades(
  poolAddress: string,
  mintAddress: string,
  connection: Connection,
  limit = 20
): Promise<Trade[]> {
  try {
    const poolPubKey = new PublicKey(poolAddress);
    const mintPubKey = new PublicKey(mintAddress);

    // Get recent signatures for the pool
    const signatures = await connection.getSignaturesForAddress(poolPubKey, { limit });
    if (signatures.length === 0) return [];

    const trades: Trade[] = [];

    // Fetch transaction details in batches or one by one
    // For simplicity and to avoid hitting rate limits too hard, we do them sequentially or in small chunks
    for (const sigInfo of signatures) {
      try {
        const tx = await connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });

        if (!tx || !tx.meta || tx.meta.err) continue;

        const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();
        const walletAddress = tx.transaction.message.accountKeys[0].pubkey.toString();

        // Detect Buy/Sell based on token balance changes
        // We look for the user's token account changes for the specific mint
        const preTokenBalance = tx.meta.preTokenBalances?.find(
          (b) => b.mint === mintAddress && b.owner === walletAddress
        );
        const postTokenBalance = tx.meta.postTokenBalances?.find(
          (b) => b.mint === mintAddress && b.owner === walletAddress
        );

        const preAmount = preTokenBalance ? Number(preTokenBalance.uiTokenAmount.amount) : 0;
        const postAmount = postTokenBalance ? Number(postTokenBalance.uiTokenAmount.amount) : 0;
        const tokenChange = (postAmount - preAmount) / 1e6; // Assume 6 decimals

        if (tokenChange === 0) continue;

        // Detect SOL change for the user
        const preSol = tx.meta.preBalances[0];
        const postSol = tx.meta.postBalances[0];
        const solChange = (preSol - postSol) / LAMPORTS_PER_SOL;

        const type = tokenChange > 0 ? 'buy' : 'sell';
        
        // Use absolute values for amounts
        const solAmount = Math.abs(solChange);
        const tokenAmount = Math.abs(tokenChange);

        trades.push({
          id: sigInfo.signature,
          launch_id: '', // Not needed for display
          mint_address: mintAddress,
          wallet_address: walletAddress,
          type,
          sol_amount: solAmount,
          token_amount: tokenAmount,
          price_per_token: solAmount / tokenAmount,
          price_impact: null,
          fee_sol: null,
          tx_signature: sigInfo.signature,
          slot: tx.slot,
          created_at: new Date(timestamp).toISOString(),
        });
      } catch (err) {
        console.warn(`Failed to parse tx ${sigInfo.signature}:`, err);
      }
    }

    return trades;
  } catch (err) {
    console.error('getOnChainTrades error:', err);
    return [];
  }
}
