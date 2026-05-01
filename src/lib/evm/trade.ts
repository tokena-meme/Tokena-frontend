import { Contract, parseEther, parseUnits, formatEther, formatUnits } from 'ethers';
import { BondingCurveABI } from './abi';
import { getEvmSigner, getEvmProvider } from './provider';
import { insertTrade, updateLaunch, getLaunchByMint } from '@/lib/supabase/queries';
import { getEvmTokenState } from './pool-state';

const PENDING_TRADES_KEY = 'tokena_pending_evm_trades';

const trimDec = (val: string | number) => {
  const str = typeof val === 'number' ? val.toLocaleString('fullwide', {useGrouping:false, maximumFractionDigits:20}) : val;
  const [int, dec] = str.split('.');
  return dec ? `${int}.${dec.slice(0, 18)}` : str;
};

// ---- Pending Trade Recovery System ----

interface PendingTrade {
  txHash: string;
  tokenAddress: string;
  walletAddress: string;
  chainKey: string;
  type: 'buy' | 'sell';
  ethAmount: number;
  tokenAmount: number;
  timestamp: number; // when trade was submitted
}

function savePendingTrade(trade: PendingTrade) {
  try {
    const existing = getPendingTrades();
    existing.push(trade);
    localStorage.setItem(PENDING_TRADES_KEY, JSON.stringify(existing));
  } catch { /* localStorage might be full */ }
}

function getPendingTrades(): PendingTrade[] {
  try {
    const raw = localStorage.getItem(PENDING_TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function removePendingTrade(txHash: string) {
  try {
    const trades = getPendingTrades().filter(t => t.txHash !== txHash);
    localStorage.setItem(PENDING_TRADES_KEY, JSON.stringify(trades));
  } catch { /* ignore */ }
}

/**
 * Call this on app startup to recover any trades that were confirmed on-chain
 * but not yet recorded to Supabase (e.g. user closed browser during confirmation).
 */
export async function recoverPendingTrades() {
  const pending = getPendingTrades();
  if (pending.length === 0) return;

  console.log(`[TradeRecovery] Found ${pending.length} pending trade(s) to check`);

  for (const trade of pending) {
    // Skip trades older than 1 hour — likely failed or already expired
    if (Date.now() - trade.timestamp > 60 * 60 * 1000) {
      removePendingTrade(trade.txHash);
      continue;
    }

    try {
      const provider = getEvmProvider(trade.chainKey);
      const receipt = await provider.getTransactionReceipt(trade.txHash);

      if (receipt && receipt.status === 1) {
        // Transaction confirmed on-chain — record to Supabase
        console.log(`[TradeRecovery] Recovering confirmed trade: ${trade.txHash}`);
        await recordTradeToSupabase(trade);
        removePendingTrade(trade.txHash);
      } else if (receipt && receipt.status === 0) {
        // Transaction failed on-chain — remove pending
        console.log(`[TradeRecovery] Trade failed on-chain, removing: ${trade.txHash}`);
        removePendingTrade(trade.txHash);
      }
      // If receipt is null, tx is still pending — leave it for next check
    } catch (err) {
      console.warn(`[TradeRecovery] Error checking trade ${trade.txHash}:`, err);
    }
  }
}

async function recordTradeToSupabase(trade: PendingTrade) {
  const launch = await getLaunchByMint(trade.tokenAddress);
  if (!launch) return;

  let spotPriceEth = trade.ethAmount / (trade.tokenAmount || 1);
  try {
    const state = await getEvmTokenState(trade.tokenAddress, trade.chainKey);
    spotPriceEth = state.currentPriceEth;
  } catch { /* use fallback price */ }

  await insertTrade({
    launch_id: launch.id,
    mint_address: trade.tokenAddress,
    wallet_address: trade.walletAddress,
    type: trade.type,
    sol_amount: 0,
    token_amount: trade.tokenAmount,
    price_per_token: spotPriceEth,
    price_impact: null,
    fee_sol: null,
    tx_signature: trade.txHash,
    slot: null,
    chain: trade.chainKey,
    eth_amount: trade.ethAmount,
  });

  // Update ETH raised
  if (trade.type === 'buy') {
    const newEthRaised = (launch.eth_raised ?? 0) + trade.ethAmount;
    await updateLaunch(launch.id, {
      eth_raised: newEthRaised,
      volume_sol: (launch.volume_sol ?? 0) + trade.ethAmount,
    } as any);
  } else {
    const newEthRaised = Math.max(0, (launch.eth_raised ?? 0) - trade.ethAmount);
    await updateLaunch(launch.id, {
      eth_raised: newEthRaised,
      volume_sol: (launch.volume_sol ?? 0) + trade.ethAmount,
    } as any);
  }
}

// ---- Trade Execution ----

export interface EvmBuyParams {
  tokenAddress: string;
  ethAmount: string;
  minTokens?: string;
  chainKey: string;
  walletAddress: string;
}

export interface EvmSellParams {
  tokenAddress: string;
  tokenAmount: string;
  minEth?: string;
  chainKey: string;
  walletAddress: string;
}

export interface EvmTradeResult {
  txHash: string;
  amountOut: string;
}

export interface EvmBuyQuote {
  tokensOut: number;
}

export interface EvmSellQuote {
  ethOut: number;
  minEthOut: number;
}

export async function quoteBuyEvm(tokenAddress: string, ethAmount: number, slippageBps: number, chainKey: string): Promise<EvmBuyQuote> {
  const provider = getEvmProvider(chainKey);
  const token = new Contract(tokenAddress, BondingCurveABI, provider);
  const ethWei = parseEther(trimDec(ethAmount));
  const estimatedTokens = await token.calculateTokenAmount(ethWei);
  return {
    tokensOut: Number(formatUnits(estimatedTokens, 18)),
  };
}

export async function quoteSellEvm(tokenAddress: string, tokenAmount: number, slippageBps: number, chainKey: string): Promise<EvmSellQuote> {
  const provider = getEvmProvider(chainKey);
  const token = new Contract(tokenAddress, BondingCurveABI, provider);
  const tokenWei = parseUnits(trimDec(tokenAmount), 18);
  const estimatedEth = await token.calculateEthAmount(tokenWei);
  
  const slippageMultiplier = (10000 - slippageBps) / 10000;
  const rawEthOut = Number(formatEther(estimatedEth));
  
  return {
    ethOut: rawEthOut,
    minEthOut: rawEthOut * slippageMultiplier,
  };
}

export async function buyTokensEvm(params: EvmBuyParams): Promise<EvmTradeResult> {
  const signer = await getEvmSigner();
  const token = new Contract(params.tokenAddress, BondingCurveABI, signer);

  const ethWei = parseEther(trimDec(params.ethAmount));
  const minTokensWei = params.minTokens ? parseUnits(trimDec(params.minTokens), 18) : BigInt(0);

  // Estimate tokens out
  const provider = getEvmProvider(params.chainKey);
  const readToken = new Contract(params.tokenAddress, BondingCurveABI, provider);
  const estimatedTokens = await readToken.calculateTokenAmount(ethWei);
  const tokensOut = formatUnits(estimatedTokens, 18);
  const ethAmountNum = parseFloat(params.ethAmount);

  // Send tx
  const tx = await token.buy(minTokensWei, { value: ethWei });

  // Save pending trade IMMEDIATELY after tx is sent (before confirmation)
  savePendingTrade({
    txHash: tx.hash,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress,
    chainKey: params.chainKey,
    type: 'buy',
    ethAmount: ethAmountNum,
    tokenAmount: parseFloat(tokensOut),
    timestamp: Date.now(),
  });

  // Wait for confirmation
  const receipt = await tx.wait();

  // Record to Supabase immediately after confirmation
  try {
    await recordTradeToSupabase({
      txHash: receipt.hash,
      tokenAddress: params.tokenAddress,
      walletAddress: params.walletAddress,
      chainKey: params.chainKey,
      type: 'buy',
      ethAmount: ethAmountNum,
      tokenAmount: parseFloat(tokensOut),
      timestamp: Date.now(),
    });
    // Remove from pending since we recorded successfully
    removePendingTrade(tx.hash);
  } catch (err) {
    console.warn('Failed to record EVM buy trade — will retry on next page load:', err);
    // Leave in pending — recoverPendingTrades() will pick it up later
  }

  return {
    txHash: receipt.hash,
    amountOut: tokensOut,
  };
}

export async function sellTokensEvm(params: EvmSellParams): Promise<EvmTradeResult> {
  const signer = await getEvmSigner();
  const token = new Contract(params.tokenAddress, BondingCurveABI, signer);

  const tokenWei = parseUnits(trimDec(params.tokenAmount), 18);
  const minEthWei = params.minEth ? parseEther(trimDec(params.minEth)) : BigInt(0);

  // Estimate ETH out
  const provider = getEvmProvider(params.chainKey);
  const readToken = new Contract(params.tokenAddress, BondingCurveABI, provider);
  const estimatedEth = await readToken.calculateEthAmount(tokenWei);
  const ethOut = formatEther(estimatedEth);
  const tokenAmountNum = parseFloat(params.tokenAmount);

  // Send tx
  const tx = await token.sell(tokenWei, minEthWei);

  // Save pending trade IMMEDIATELY after tx is sent (before confirmation)
  savePendingTrade({
    txHash: tx.hash,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress,
    chainKey: params.chainKey,
    type: 'sell',
    ethAmount: parseFloat(ethOut),
    tokenAmount: tokenAmountNum,
    timestamp: Date.now(),
  });

  // Wait for confirmation
  const receipt = await tx.wait();

  // Record to Supabase immediately after confirmation
  try {
    await recordTradeToSupabase({
      txHash: receipt.hash,
      tokenAddress: params.tokenAddress,
      walletAddress: params.walletAddress,
      chainKey: params.chainKey,
      type: 'sell',
      ethAmount: parseFloat(ethOut),
      tokenAmount: tokenAmountNum,
      timestamp: Date.now(),
    });
    // Remove from pending since we recorded successfully
    removePendingTrade(tx.hash);
  } catch (err) {
    console.warn('Failed to record EVM sell trade — will retry on next page load:', err);
    // Leave in pending — recoverPendingTrades() will pick it up later
  }

  return {
    txHash: receipt.hash,
    amountOut: ethOut,
  };
}
