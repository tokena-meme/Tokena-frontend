import { Contract, parseEther, parseUnits, formatEther, formatUnits } from 'ethers';
import { BondingCurveABI } from './abi';
import { getEvmSigner, getEvmProvider } from './provider';
import { insertTrade, updateLaunch, getLaunchByMint } from '@/lib/supabase/queries';
import { getEvmTokenState } from './pool-state';

const trimDec = (val: string | number) => {
  const str = typeof val === 'number' ? val.toLocaleString('fullwide', {useGrouping:false, maximumFractionDigits:20}) : val;
  const [int, dec] = str.split('.');
  return dec ? `${int}.${dec.slice(0, 18)}` : str;
};

export interface EvmBuyParams {
  tokenAddress: string;
  ethAmount: string; // in ETH e.g. "0.5"
  minTokens?: string; // minimum tokens out (slippage), default "0"
  chainKey: string;
  walletAddress: string;
}

export interface EvmSellParams {
  tokenAddress: string;
  tokenAmount: string; // in token units (human-readable)
  minEth?: string; // minimum ETH out (slippage), default "0"
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

  const tx = await token.buy(minTokensWei, { value: ethWei });
  const receipt = await tx.wait();

  const tokensOut = formatUnits(estimatedTokens, 18);
  const ethAmountNum = parseFloat(params.ethAmount);

  // Record trade in Supabase
  try {
    const launch = await getLaunchByMint(params.tokenAddress);
    if (launch) {
      let spotPriceEth = ethAmountNum / parseFloat(tokensOut); // fallback
      try {
        const state = await getEvmTokenState(params.tokenAddress, params.chainKey);
        spotPriceEth = state.currentPriceEth;
      } catch (err) {
         console.warn('Failed to fetch post-buy spot price:', err);
      }

      await insertTrade({
        launch_id: launch.id,
        mint_address: params.tokenAddress,
        wallet_address: params.walletAddress,
        type: 'buy',
        sol_amount: 0,
        token_amount: parseFloat(tokensOut),
        price_per_token: spotPriceEth,
        price_impact: null,
        fee_sol: null,
        tx_signature: receipt.hash,
        slot: null,
        chain: params.chainKey,
        eth_amount: ethAmountNum,
      });

      // Update ETH raised
      const newEthRaised = (launch.eth_raised ?? 0) + ethAmountNum;
      await updateLaunch(launch.id, {
        eth_raised: newEthRaised,
        volume_sol: (launch.volume_sol ?? 0) + ethAmountNum,
      } as any);
    }
  } catch (err) {
    console.warn('Failed to record EVM trade:', err);
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

  const tx = await token.sell(tokenWei, minEthWei);
  const receipt = await tx.wait();

  const ethOut = formatEther(estimatedEth);
  const tokenAmountNum = parseFloat(params.tokenAmount);

  // Record trade in Supabase
  try {
    const launch = await getLaunchByMint(params.tokenAddress);
    if (launch) {
      let spotPriceEth = parseFloat(ethOut) / tokenAmountNum; // fallback
      try {
        const state = await getEvmTokenState(params.tokenAddress, params.chainKey);
        spotPriceEth = state.currentPriceEth;
      } catch (err) {
         console.warn('Failed to fetch post-sell spot price:', err);
      }

      await insertTrade({
        launch_id: launch.id,
        mint_address: params.tokenAddress,
        wallet_address: params.walletAddress,
        type: 'sell',
        sol_amount: 0,
        token_amount: tokenAmountNum,
        price_per_token: spotPriceEth,
        price_impact: null,
        fee_sol: null,
        tx_signature: receipt.hash,
        slot: null,
        chain: params.chainKey,
        eth_amount: parseFloat(ethOut),
      });

      // Update ETH raised
      const newEthRaised = Math.max(0, (launch.eth_raised ?? 0) - parseFloat(ethOut));
      await updateLaunch(launch.id, {
        eth_raised: newEthRaised,
        volume_sol: (launch.volume_sol ?? 0) + parseFloat(ethOut),
      } as any);
    }
  } catch (err) {
    console.warn('Failed to record EVM trade:', err);
  }

  return {
    txHash: receipt.hash,
    amountOut: ethOut,
  };
}
